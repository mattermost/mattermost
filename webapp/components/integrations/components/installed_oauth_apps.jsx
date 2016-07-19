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

        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_oauth_apps.header'
                        defaultMessage='Installed OAuth2 Apps'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_oauth_apps.add'
                        defaultMessage='Add OAuth2 App'
                    />
                }
                addLink={'/' + this.props.team.name + '/integrations/oauth2-apps/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_oauth_apps.empty'
                        defaultMessage='No OAuth2 Apps found'
                    />
                }
                searchPlaceholder={localizeMessage('installed_oauth_apps.search', 'Search OAuth2 Apps')}
                loading={this.state.loading}
            >
                {oauthApps}
            </BackstageList>
        );
    }
}
