// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class OAuthSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableOAuthServiceProvider: props.config.ServiceSettings.EnableOAuthServiceProvider
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableOAuthServiceProvider = this.state.enableOAuthServiceProvider;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.authentication.title'
                    defaultMessage='Authentication Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.authentication.oauth'
                        defaultMessage='OAuth Provider'
                    />
                }
            >
                <BooleanSetting
                    id='enableOAuthServiceProvider'
                    label={
                        <FormattedMessage
                            id='admin.oauth.providerTitle'
                            defaultMessage='Enable OAuth Service Provider:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.oauth.providerDescription'
                            defaultMessage='When true, Mattermost can act as an OAuth provider to authenticate users.'
                        />
                    }
                    value={this.state.enableOAuthServiceProvider}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}