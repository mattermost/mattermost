// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import UserStore from 'stores/user_store.jsx';
import IntegrationStore from 'stores/integration_store.jsx';
import * as OAuthActions from 'actions/oauth_actions.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
import InstalledOAuthApp from './installed_oauth_app.jsx';
import InstalledIntegrations from './installed_integrations.jsx';

export default class InstalledOAuthApps extends React.Component {
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
            <InstalledIntegrations
                header={
                    <FormattedMessage
                        id='installed_oauth_apps.header'
                        defaultMessage='Installed OAuth Apps'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_oauth_apps.add'
                        defaultMessage='Add OAuth App'
                    />
                }
                addLink={'/' + Utils.getTeamNameFromUrl() + '/settings/integrations/oauth-apps/add'}
                emptyText={
                    <FormattedMessage
                        id='installed_oauth_apps.empty'
                        defaultMessage='No OAuth Apps found'
                    />
                }
                loading={this.state.loading}
            >
                {oauthApps}
            </InstalledIntegrations>
        );
    }
}
