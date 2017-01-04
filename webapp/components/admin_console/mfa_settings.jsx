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
            <h3>
                <FormattedMessage
                    id='admin.mfa.title'
                    defaultMessage='Multi-factor Authentication'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.mfa.bannerDesc'
                            defaultMessage='Multi-factor authentication is only available for accounts with LDAP and email login methods. If there are users on your system with other login methods, it is recommended you set up multi-factor authentication directly with the SSO or SAML provider.'
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
                            defaultMessage='When true, users will be given the option to add multi-factor authentication to their account. They will need a smartphone and an authenticator app such as Google Authenticator.'
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
                            defaultMessage="When true, users on the system will be required to set up <a href='https://docs.mattermost.com/deployment/auth.html' target='_blank'>multi-factor authentication</a>. Any logged in users will be redirected to the multi-factor authentication setup page until they successfully add MFA to their account.<br/><br/>It is recommended you turn on enforcement during non-peak hours, when people are less likely to be using the system. New users will be required to set up multi-factor authentication when they first sign up. After set up, users will not be able to remove multi-factor authentication unless enforcement is disabled.<br/><br/>Please note that multi-factor authentication is only available for accounts with LDAP and email login methods. Mattermost will not enforce multi-factor authentication for other login methods. If there are users on your system using other login methods, it is recommended you set up and enforce multi-factor authentication directly with the SSO or SAML provider."
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
