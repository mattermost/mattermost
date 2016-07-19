// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import SettingsGroup from './settings_group.jsx';
import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';

export default class OAuthSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        const domains = [];
        if (this.state.frameDomains) {
            for (let domain of this.state.frameDomains.split('\n')) {
                domain = domain.trim();

                if (domain.length > 0) {
                    domains.push(domain);
                }
            }
        }
        config.ServiceSettings.EnableOAuthServiceProvider = this.state.enableOAuthServiceProvider;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableOAuthServiceProvider: config.ServiceSettings.EnableOAuthServiceProvider
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.oauth'
                    defaultMessage='OAuth2 Provider'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableOAuthServiceProvider'
                    label={
                        <FormattedMessage
                            id='admin.oauth.providerTitle'
                            defaultMessage='Enable OAuth2 Service Provider:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.oauth.providerDescription'
                            defaultMessage='When true, Mattermost can act as an OAuth2 Service Provider to authenticate users.'
                        />
                    }
                    value={this.state.enableOAuthServiceProvider}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}