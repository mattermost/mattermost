// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import Setting from './setting.jsx';

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
            passwordSymbol: props.config.PasswordSettings.Symbol
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
        this.getSampleErrorMsg();
    }

    getConfigFromState(config) {
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.PasswordRequirements === 'true') {
            config.PasswordSettings.MinimumLength = parseInt(this.state.passwordMinimumLength, 10);
            config.PasswordSettings.Lowercase = this.refs.lowercase.checked;
            config.PasswordSettings.Uppercase = this.refs.uppercase.checked;
            config.PasswordSettings.Number = this.refs.number.checked;
            config.PasswordSettings.Symbol = this.refs.symbol.checked;
        }
        return config;
    }

    getSampleErrorMsg() {
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
        this.sampleErrorMsg = (
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
        if (!(global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.PasswordRequirements === 'true')) {
            return null;
        }

        return (
            <SettingsGroup>
                <TextSetting
                    id='passwordMinimumLength'
                    label={
                        <FormattedMessage
                            id='admin.password.minimumLength'
                            defaultMessage='Minimum Password Length:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.password.minimumLengthDescription'
                            defaultMessage='Minimum number of characters required for a valid password.'
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
            </SettingsGroup>
        );
    }
}