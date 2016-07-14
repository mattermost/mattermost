// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import BooleanSetting from './boolean_setting.jsx';
import Setting from './setting.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import GeneratedSetting from './generated_setting.jsx';

export default class PasswordSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.getSampleErrorMsg = this.getSampleErrorMsg.bind(this);

        this.state = Object.assign(this.state, {
            passwordMinimumLength: props.config.PasswordSettings.MinimumLength,
            passwordLowercase: props.config.PasswordSettings.Lowercase,
            passwordNumber: props.config.PasswordSettings.Number,
            passwordUppercase: props.config.PasswordSettings.Uppercase,
            passwordSymbol: props.config.PasswordSettings.Symbol,
            maximumLoginAttempts: props.config.ServiceSettings.MaximumLoginAttempts,
            enableMultifactorAuthentication: props.config.ServiceSettings.EnableMultifactorAuthentication,
            passwordResetSalt: props.config.EmailSettings.PasswordResetSalt
        });

        // Update sample message from config settings
        let sampleErrorMsgId = 'user.settings.security.passwordError';
        if (props.config.PasswordSettings.Lowercase) {
            sampleErrorMsgId = sampleErrorMsgId + 'Lowercase';
        }
        if (props.config.PasswordSettings.Uppercase) {
            sampleErrorMsgId = sampleErrorMsgId + 'Uppercase';
        }
        if (props.config.PasswordSettings.Number) {
            sampleErrorMsgId = sampleErrorMsgId + 'Number';
        }
        if (props.config.PasswordSettings.Symbol) {
            sampleErrorMsgId = sampleErrorMsgId + 'Symbol';
        }
        this.sampleErrorMsg = (
            <FormattedMessage
                id={sampleErrorMsgId}
                default='Your password must be at least {min} characters.'
                values={{
                    min: props.config.PasswordSettings.MinimumLength
                }}
            />
        );
    }

    componentWillUpdate() {
        this.sampleErrorMsg = this.getSampleErrorMsg();
    }

    getConfigFromState(config) {
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.PasswordRequirements === 'true') {
            config.PasswordSettings.MinimumLength = this.parseIntNonZero(this.state.passwordMinimumLength, Constants.MIN_PASSWORD_LENGTH);
            config.PasswordSettings.Lowercase = this.refs.lowercase.checked;
            config.PasswordSettings.Uppercase = this.refs.uppercase.checked;
            config.PasswordSettings.Number = this.refs.number.checked;
            config.PasswordSettings.Symbol = this.refs.symbol.checked;
        }

        config.ServiceSettings.MaximumLoginAttempts = this.parseIntNonZero(this.state.maximumLoginAttempts);
        config.EmailSettings.PasswordResetSalt = this.state.passwordResetSalt;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true') {
            config.ServiceSettings.EnableMultifactorAuthentication = this.state.enableMultifactorAuthentication;
        }

        return config;
    }

    getStateFromConfig(config) {
        return {
            passwordMinimumLength: config.PasswordSettings.MinimumLength,
            passwordLowercase: config.PasswordSettings.Lowercase,
            passwordNumber: config.PasswordSettings.Number,
            passwordUppercase: config.PasswordSettings.Uppercase,
            passwordSymbol: config.PasswordSettings.Symbol,
            maximumLoginAttempts: config.ServiceSettings.MaximumLoginAttempts,
            enableMultifactorAuthentication: config.ServiceSettings.EnableMultifactorAuthentication,
            passwordResetSalt: config.EmailSettings.PasswordResetSalt
        };
    }

    getSampleErrorMsg() {
        if (this.props.config.PasswordSettings.MinimumLength > Constants.MAX_PASSWORD_LENGTH || this.props.config.PasswordSettings.MinimumLength < Constants.MIN_PASSWORD_LENGTH) {
            return (
                <FormattedMessage
                    id='user.settings.security.passwordMinLength'
                    default='Invalid minimum length, cannot show preview.'
                />
            );
        }

        let sampleErrorMsgId = 'user.settings.security.passwordError';
        if (this.refs.lowercase.checked) {
            sampleErrorMsgId = sampleErrorMsgId + 'Lowercase';
        }
        if (this.refs.uppercase.checked) {
            sampleErrorMsgId = sampleErrorMsgId + 'Uppercase';
        }
        if (this.refs.number.checked) {
            sampleErrorMsgId = sampleErrorMsgId + 'Number';
        }
        if (this.refs.symbol.checked) {
            sampleErrorMsgId = sampleErrorMsgId + 'Symbol';
        }
        return (
            <FormattedMessage
                id={sampleErrorMsgId}
                default='Your password must be at least {min} characters.'
                values={{
                    min: this.props.config.PasswordSettings.MinimumLength
                }}
            />
        );
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.password'
                    defaultMessage='Password'
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

        let passwordSettings = null;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.PasswordRequirements === 'true') {
            passwordSettings = (
                <div>
                    <TextSetting
                        id='passwordMinimumLength'
                        label={
                            <FormattedMessage
                                id='admin.password.minimumLength'
                                defaultMessage='Minimum Password Length:'
                            />
                        }
                        placeholder={Utils.localizeMessage('admin.password.minimumLengthExample', 'Ex "5"')}
                        helpText={
                            <FormattedMessage
                                id='admin.password.minimumLengthDescription'
                                defaultMessage='Minimum number of characters required for a valid password. Must be a whole number greater than or equal to {min} and less than or equal to {max}.'
                                values={{
                                    min: Constants.MIN_PASSWORD_LENGTH,
                                    max: Constants.MAX_PASSWORD_LENGTH
                                }}
                            />
                        }
                        value={this.state.passwordMinimumLength}
                        onChange={this.handleChange}
                    />
                    <Setting
                        label={
                            <FormattedMessage
                                id='passwordRequirements'
                                defaultMessage='Password Requirements:'
                            />
                        }
                    >
                        <div>
                            <label className='checkbox-inline'>
                                <input
                                    type='checkbox'
                                    ref='lowercase'
                                    defaultChecked={this.state.passwordLowercase}
                                    name='admin.password.lowercase'
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.password.lowercase'
                                    defaultMessage='At least one lowercase letter'
                                />
                            </label>
                        </div>
                        <div>
                            <label className='checkbox-inline'>
                                <input
                                    type='checkbox'
                                    ref='uppercase'
                                    defaultChecked={this.state.passwordUppercase}
                                    name='admin.password.uppercase'
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.password.uppercase'
                                    defaultMessage='At least one uppercase letter'
                                />
                            </label>
                        </div>
                        <div>
                            <label className='checkbox-inline'>
                                <input
                                    type='checkbox'
                                    ref='number'
                                    defaultChecked={this.state.passwordNumber}
                                    name='admin.password.number'
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.password.number'
                                    defaultMessage='At least one number'
                                />
                            </label>
                        </div>
                        <div>
                            <label className='checkbox-inline'>
                                <input
                                    type='checkbox'
                                    ref='symbol'
                                    defaultChecked={this.state.passwordSymbol}
                                    name='admin.password.symbol'
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.password.symbol'
                                    defaultMessage='At least one symbol (e.g. "~!@#$%^&*()")'
                                />
                            </label>
                        </div>
                        <div>
                            <br/>
                            <label>
                                <FormattedMessage
                                    id='admin.password.preview'
                                    defaultMessage='Error message preview:'
                                />
                            </label>
                            <br/>
                            {this.sampleErrorMsg}
                        </div>
                    </Setting>
                </div>
            );
        }

        return (
            <SettingsGroup>
                {passwordSettings}
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
                            defaultMessage='32-character salt added to signing of password reset emails. Randomly generated on install. Click "Regenerate" to create new salt.'
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