// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class LoginSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            passwordResetSalt: props.config.EmailSettings.PasswordResetSalt,
            maximumLoginAttempts: props.config.ServiceSettings.MaximumLoginAttempts,
            enableMultifactorAuthentication: props.config.ServiceSettings.EnableMultifactorAuthentication
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.PasswordResetSalt = this.state.passwordResetSalt;
        config.ServiceSettings.MaximumLoginAttempts = this.parseIntNonZero(this.state.maximumLoginAttempts);
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true') {
            config.ServiceSettings.EnableMultifactorAuthentication = this.state.enableMultifactorAuthentication;
        }

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.title'
                    defaultMessage='Security Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        let mfaSetting = null;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true') {
            mfaSetting = (
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
            );
        }

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.security.login'
                        defaultMessage='Login'
                    />
                }
            >
                <GeneratedSetting
                    id='passwordResetSalt'
                    label={
                        <FormattedMessage
                            id='admin.email.passwordSaltTitle'
                            defaultMessage='Password Reset Salt:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.passwordSaltDescription'
                            defaultMessage='32-character salt added to signing of password reset emails. Randomly generated on install. Click "Re-Generate" to create new salt.'
                        />
                    }
                    value={this.state.passwordResetSalt}
                    onChange={this.handleChange}
                    disabled={this.state.sendEmailNotifications}
                    disabledText={
                        <FormattedMessage
                            id='admin.security.passwordResetSalt.disabled'
                            defaultMessage='Password reset salt cannot be changed while sending emails is disabled.'
                        />
                    }
                />
                <TextSetting
                    id='maximumLoginAttempts'
                    label={
                        <FormattedMessage
                            id='admin.service.attemptTitle'
                            defaultMessage='Maximum Login Attempts:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.attemptExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.attemptDescription'
                            defaultMessage='Login attempts allowed before user is locked out and required to reset password via email.'
                        />
                    }
                    value={this.state.maximumLoginAttempts}
                    onChange={this.handleChange}
                />
                {mfaSetting}
            </SettingsGroup>
        );
    }
}