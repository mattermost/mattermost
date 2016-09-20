// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import UserStore from 'stores/user_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as OAuthActions from 'actions/oauth_actions.jsx';
import {localizeMessage} from 'utils/utils.jsx';

import BackstageList from 'components/backstage/components/backstage_list.jsx';
import {FormattedMessage} from 'react-intl';
import InstalledOAuthApp from './installed_oauth_app.jsx';

export default class InstalledOAuthApps extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.deleteOAuthApp = this.deleteOAuthApp.bind(this);

        const userId = UserStore.getCurrentId();

        this.state = {
            oauthApps: IntegrationStore.getOAuthApps(userId),
            loading: !IntegrationStore.hasReceivedOAuthApps(userId)
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableOAuthServiceProvider === 'true') {
            OAuthActions.listOAuthApps(UserStore.getCurrentId());
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const userId = UserStore.getCurrentId();

        this.setState({
            oauthApps: IntegrationStore.getOAuthApps(userId),
            loading: !IntegrationStore.hasReceivedOAuthApps(userId)
        });
    }

    deleteOAuthApp(app) {
        const userId = UserStore.getCurrentId();
        OAuthActions.deleteOAuthApp(app.id, userId);
    }

    render() {
        const oauthApps = this.state.oauthApps.map((app) => {
            return (
                <InstalledOAuthApp
                    key={app.id}
                    oauthApp={app}
                    onDelete={this.deleteOAuthApp}
                />
            );
        });

        const isSystemAdmin = UserStore.isSystemAdminForCurrentUser();
        const config = global.mm_config;
        const integrationsEnabled = (config.EnableOAuthServiceProvider === 'true' && (isSystemAdmin || config.EnableOnlyAdminIntegrations !== 'true'));
        let props;
        if (integrationsEnabled) {
            props = {
                addLink: '/' + this.props.team.name + '/integrations/oauth2-apps/add',
                addText: localizeMessage('installed_oauth_apps.add', 'Add OAuth 2.0 Application')
            };
        }

        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_oauth_apps.header'
                        defaultMessage='OAuth 2.0 Applications'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_oauth_apps.help'
                        defaultMessage='Create OAuth 2.0 applications to securely integrate bots and third-party applications with Mattermost. Please see {link} to learn more.'
                        values={{
                            link: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='https://docs.mattermost.com/developer/oauth-2-0-applications.html'
                                >
                                    <FormattedMessage
                                        id='installed_oauth_apps.helpLink'
                                        defaultMessage='documentation'
                                    />
                                </a>
                            )
                        }}
                    />
                }
                emptyText={
                    <FormattedMessage
                        id='installed_oauth_apps.empty'
                        defaultMessage='No OAuth 2.0 Applications found'
                    />
                }
                searchPlaceholder={localizeMessage('installed_oauth_apps.search', 'Search OAuth 2.0 Applications')}
                loading={this.state.loading}
                {...props}
            >
                {oauthApps}
            </BackstageList>
        );
    }
}
