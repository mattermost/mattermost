// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

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
            team: PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);

        this.deleteOAuthApp = this.deleteOAuthApp.bind(this);

        this.state = {
            oauthApps: IntegrationStore.getOAuthApps(),
            loading: !IntegrationStore.hasReceivedOAuthApps()
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableOAuthServiceProvider === 'true') {
            OAuthActions.listOAuthApps(() => this.setState({loading: false}));
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        this.setState({
            oauthApps: IntegrationStore.getOAuthApps()
        });
    }

    deleteOAuthApp(app) {
        OAuthActions.deleteOAuthApp(app.id);
    }

    oauthAppCompare(a, b) {
        let nameA = a.name;
        if (!nameA) {
            nameA = localizeMessage('installed_integrations.unnamed_oauth_app', 'Unnamed OAuth 2.0 Application');
        }

        let nameB = b.name;
        if (!nameB) {
            nameB = localizeMessage('installed_integrations.unnamed_oauth_app', 'Unnamed OAuth 2.0 Application');
        }

        return nameA.localeCompare(nameB);
    }

    render() {
        const oauthApps = this.state.oauthApps.sort(this.oauthAppCompare).map((app) => {
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
                        defaultMessage='Create {oauthApplications} to securely integrate bots and third-party apps with Mattermost. Visit the {appDirectory} to find available self-hosted apps.'
                        values={{
                            oauthApplications: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='https://docs.mattermost.com/developer/oauth-2-0-applications.html'
                                >
                                    <FormattedMessage
                                        id='installed_oauth_apps.help.oauthApplications'
                                        defaultMessage='OAuth 2.0 applications'
                                    />
                                </a>
                            ),
                            appDirectory: (
                                <a
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    href='https://about.mattermost.com/default-app-directory/'
                                >
                                    <FormattedMessage
                                        id='installed_oauth_apps.help.appDirectory'
                                        defaultMessage='App Directory'
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
