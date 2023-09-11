// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import * as Utils from 'utils/utils';

import AdminSettings from './admin_settings';
import type {BaseProps, BaseState} from './admin_settings';
import BlockableLink from './blockable_link';
import BooleanSetting from './boolean_setting';
import Setting from './setting';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

type Props = BaseProps & {
    config: AdminConfig;
};

type State = BaseState & {
    passwordMinimumLength?: string;
    passwordLowercase?: boolean;
    passwordNumber?: boolean;
    passwordUppercase?: boolean;
    passwordSymbol?: boolean;
    passwordEnableForgotLink?: boolean;
    maximumLoginAttempts?: string;
};

export default class PasswordSettings extends AdminSettings<Props, State> {
    sampleErrorMsg: React.ReactNode;

    constructor(props: Props) {
        super(props);

        this.state = Object.assign(this.state, {
            passwordMinimumLength: props.config.PasswordSettings.MinimumLength,
            passwordLowercase: props.config.PasswordSettings.Lowercase,
            passwordNumber: props.config.PasswordSettings.Number,
            passwordUppercase: props.config.PasswordSettings.Uppercase,
            passwordSymbol: props.config.PasswordSettings.Symbol,
            passwordEnableForgotLink: props.config.PasswordSettings.EnableForgotLink,
            maximumLoginAttempts: props.config.ServiceSettings.MaximumLoginAttempts,
        });

        // Update sample message from config settings
        t('user.settings.security.passwordErrorLowercase');
        t('user.settings.security.passwordErrorLowercaseUppercase');
        t('user.settings.security.passwordErrorLowercaseUppercaseNumber');
        t('user.settings.security.passwordErrorLowercaseUppercaseNumberSymbol');
        t('user.settings.security.passwordErrorLowercaseUppercaseSymbol');
        t('user.settings.security.passwordErrorLowercaseNumber');
        t('user.settings.security.passwordErrorLowercaseNumberSymbol');
        t('user.settings.security.passwordErrorLowercaseSymbol');
        t('user.settings.security.passwordErrorUppercase');
        t('user.settings.security.passwordErrorUppercaseNumber');
        t('user.settings.security.passwordErrorUppercaseNumberSymbol');
        t('user.settings.security.passwordErrorUppercaseSymbol');
        t('user.settings.security.passwordErrorNumber');
        t('user.settings.security.passwordErrorNumberSymbol');
        t('user.settings.security.passwordErrorSymbol');

        let sampleErrorMsgId = 'user.settings.security.passwordError';
        if (props.config.PasswordSettings.Lowercase) {
            sampleErrorMsgId += 'Lowercase';
        }
        if (props.config.PasswordSettings.Uppercase) {
            sampleErrorMsgId += 'Uppercase';
        }
        if (props.config.PasswordSettings.Number) {
            sampleErrorMsgId += 'Number';
        }
        if (props.config.PasswordSettings.Symbol) {
            sampleErrorMsgId += 'Symbol';
        }
        this.sampleErrorMsg = (
            <FormattedMessage
                id={sampleErrorMsgId}
                defaultMessage='Your password must contain between {min} and {max} characters.'
                values={{
                    min: (this.state.passwordMinimumLength || Constants.MIN_PASSWORD_LENGTH),
                    max: Constants.MAX_PASSWORD_LENGTH,
                }}
            />
        );
    }

    getConfigFromState = (config: DeepPartial<AdminConfig>) => {
        if (config.PasswordSettings) {
            config.PasswordSettings.MinimumLength = this.parseIntNonZero(this.state.passwordMinimumLength ?? '', Constants.MIN_PASSWORD_LENGTH);
            config.PasswordSettings.Lowercase = this.state.passwordLowercase;
            config.PasswordSettings.Uppercase = this.state.passwordUppercase;
            config.PasswordSettings.Number = this.state.passwordNumber;
            config.PasswordSettings.Symbol = this.state.passwordSymbol;
            config.PasswordSettings.EnableForgotLink = this.state.passwordEnableForgotLink;
        }

        if (config.ServiceSettings) {
            config.ServiceSettings.MaximumLoginAttempts = this.parseIntNonZero(this.state.maximumLoginAttempts ?? '', Constants.MAXIMUM_LOGIN_ATTEMPTS_DEFAULT);
        }

        return config;
    };

    getStateFromConfig(config: DeepPartial<AdminConfig>) {
        return {
            passwordMinimumLength: String(config.PasswordSettings?.MinimumLength),
            passwordLowercase: config.PasswordSettings?.Lowercase,
            passwordNumber: config.PasswordSettings?.Number,
            passwordUppercase: config.PasswordSettings?.Uppercase,
            passwordSymbol: config.PasswordSettings?.Symbol,
            passwordEnableForgotLink: config.PasswordSettings?.EnableForgotLink,
            maximumLoginAttempts: String(config.ServiceSettings?.MaximumLoginAttempts),
        };
    }

    getSampleErrorMsg = () => {
        if (this.props.config.PasswordSettings.MinimumLength > Constants.MAX_PASSWORD_LENGTH || this.props.config.PasswordSettings.MinimumLength < Constants.MIN_PASSWORD_LENGTH) {
            return (
                <FormattedMessage
                    id='user.settings.security.passwordMinLength'
                    defaultMessage='Invalid minimum length, cannot show preview.'
                />
            );
        }
        let sampleErrorMsgId = 'user.settings.security.passwordError';
        if (this.state.passwordLowercase) {
            sampleErrorMsgId += 'Lowercase';
        }
        if (this.state.passwordUppercase) {
            sampleErrorMsgId += 'Uppercase';
        }
        if (this.state.passwordNumber) {
            sampleErrorMsgId += 'Number';
        }
        if (this.state.passwordSymbol) {
            sampleErrorMsgId += 'Symbol';
        }
        return (
            <FormattedMessage
                id={sampleErrorMsgId}
                defaultMessage='Your password must contain between {min} and {max} characters.'
                values={{
                    min: (this.state.passwordMinimumLength || Constants.MIN_PASSWORD_LENGTH),
                    max: Constants.MAX_PASSWORD_LENGTH,
                }}
            />
        );
    };

    handleCheckboxChange = (id: string) => {
        return (event: React.ChangeEvent<HTMLInputElement>) => {
            this.handleChange(id, event.target.checked);
        };
    };

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.security.password'
                defaultMessage='Password'
            />
        );
    }

    renderSettings = () => {
        return (
            <SettingsGroup>
                <div>
                    <TextSetting
                        id='passwordMinimumLength'
                        label={
                            <FormattedMessage
                                id='admin.password.minimumLength'
                                defaultMessage='Minimum Password Length:'
                            />
                        }
                        placeholder={Utils.localizeMessage('admin.password.minimumLengthExample', 'E.g.: "5"')}
                        helpText={
                            <FormattedMessage
                                id='admin.password.minimumLengthDescription'
                                defaultMessage='Minimum number of characters required for a valid password. Must be a whole number greater than or equal to {min} and less than or equal to {max}.'
                                values={{
                                    min: Constants.MIN_PASSWORD_LENGTH,
                                    max: Constants.MAX_PASSWORD_LENGTH,
                                }}
                            />
                        }
                        value={this.state.passwordMinimumLength ?? ''}
                        onChange={this.handleChange}
                        setByEnv={this.isSetByEnv('PasswordSettings.MinimumLength')}
                        disabled={this.props.isDisabled}
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
                                    defaultChecked={this.state.passwordLowercase}
                                    name='admin.password.lowercase'
                                    disabled={this.props.isDisabled}
                                    onChange={this.handleCheckboxChange('passwordLowercase')}
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
                                    defaultChecked={this.state.passwordUppercase}
                                    name='admin.password.uppercase'
                                    disabled={this.props.isDisabled}
                                    onChange={this.handleCheckboxChange('passwordUppercase')}
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
                                    defaultChecked={this.state.passwordNumber}
                                    name='admin.password.number'
                                    disabled={this.props.isDisabled}
                                    onChange={this.handleCheckboxChange('passwordNumber')}
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
                                    defaultChecked={this.state.passwordSymbol}
                                    name='admin.password.symbol'
                                    disabled={this.props.isDisabled}
                                    onChange={this.handleCheckboxChange('passwordSymbol')}
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
                            {this.getSampleErrorMsg()}
                        </div>
                    </Setting>
                </div>
                {!this.props.config.ExperimentalSettings?.RestrictSystemAdmin &&
                (
                    <TextSetting
                        id='maximumLoginAttempts'
                        label={
                            <FormattedMessage
                                id='admin.service.attemptTitle'
                                defaultMessage='Maximum Login Attempts:'
                            />
                        }
                        placeholder={Utils.localizeMessage('admin.service.attemptExample', 'E.g.: "10"')}
                        helpText={
                            <FormattedMessage
                                id='admin.service.attemptDescription'
                                defaultMessage='Login attempts allowed before user is locked out and required to reset password via email.'
                            />
                        }
                        value={this.state.maximumLoginAttempts ?? ''}
                        onChange={this.handleChange}
                        setByEnv={this.isSetByEnv('ServiceSettings.MaximumLoginAttempts')}
                        disabled={this.props.isDisabled}
                    />
                )
                }
                <BooleanSetting
                    id='passwordEnableForgotLink'
                    label={
                        <FormattedMessage
                            id='admin.password.enableForgotLink.title'
                            defaultMessage='Enable Forgot Password Link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.password.enableForgotLink.description'
                            defaultMessage='When true, “Forgot password” link appears on the Mattermost login page, which allows users to reset their password. When false, the link is hidden from users. This link can be customized to redirect to a URL of your choice from <a>Site Configuration > Customization.</a>'
                            values={{
                                a: (chunks) => (
                                    <BlockableLink to='/admin_console/site_config/customization'>
                                        {chunks}
                                    </BlockableLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.passwordEnableForgotLink ?? false}
                    setByEnv={false}
                    onChange={this.handleChange}
                    disabled={this.props.isDisabled}
                />
            </SettingsGroup>
        );
    };
}
