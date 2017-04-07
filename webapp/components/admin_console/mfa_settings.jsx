// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AdminSettings from './admin_settings.jsx';
import SettingsGroup from './settings_group.jsx';
import BooleanSetting from './boolean_setting.jsx';

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class MfaSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableMultifactorAuthentication: props.config.ServiceSettings.EnableMultifactorAuthentication,
            enforceMultifactorAuthentication: props.config.ServiceSettings.EnforceMultifactorAuthentication
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableMultifactorAuthentication = this.state.enableMultifactorAuthentication;
        config.ServiceSettings.EnforceMultifactorAuthentication = this.state.enableMultifactorAuthentication && this.state.enforceMultifactorAuthentication;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableMultifactorAuthentication: config.ServiceSettings.EnableMultifactorAuthentication,
            enforceMultifactorAuthentication: config.ServiceSettings.EnableMultifactorAuthentication && config.ServiceSettings.EnforceMultifactorAuthentication
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.mfa.title'
                defaultMessage='Multi-factor Authentication'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='admin.mfa.bannerDesc'
                            defaultMessage="<a href='https://docs.mattermost.com/deployment/auth.html' target='_blank'>Multi-factor authentication</a> is available for accounts with AD/LDAP or email login. If other login methods are used, MFA should be configured with the authentication provider."
                        />
                    </div>
                </div>
                <BooleanSetting
                    id='enableMultifactorAuthentication'
                    label={
                        <FormattedMessage
                            id='admin.service.mfaTitle'
                            defaultMessage='Enable Multi-factor Authentication:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.mfaDesc'
                            defaultMessage='When true, users with AD/LDAP or email login can add multi-factor authentication to their account using Google Authenticator.'
                        />
                    }
                    value={this.state.enableMultifactorAuthentication}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enforceMultifactorAuthentication'
                    label={
                        <FormattedMessage
                            id='admin.service.enforceMfaTitle'
                            defaultMessage='Enforce Multi-factor Authentication:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.enforceMfaDesc'
                            defaultMessage="When true, <a href='https://docs.mattermost.com/deployment/auth.html' target='_blank'>multi-factor authentication</a> is required for login. New users will be required to configure MFA on signup. Logged in users without MFA configured are redirected to the MFA setup page until configuration is complete.<br/><br/>If your system has users with login methods other than AD/LDAP and email, MFA must be enforced with the authentication provider outside of Mattermost."
                        />
                    }
                    disabled={!this.state.enableMultifactorAuthentication}
                    value={this.state.enforceMultifactorAuthentication}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
