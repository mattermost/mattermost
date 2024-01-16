// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import Constants from 'utils/constants';

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

const messages = defineMessages({
    passwordMinLength: {id: 'user.settings.security.passwordMinLength', defaultMessage: 'Invalid minimum length, cannot show preview.'},
    password: {id: 'admin.security.password', defaultMessage: 'Password'},
    minimumLength: {id: 'admin.password.minimumLength', defaultMessage: 'Minimum Password Length:'},
    minimumLengthDescription: {id: 'admin.password.minimumLengthDescription', defaultMessage: 'Minimum number of characters required for a valid password. Must be a whole number greater than or equal to {min} and less than or equal to {max}.'},
    lowercase: {id: 'admin.password.lowercase', defaultMessage: 'At least one lowercase letter'},
    uppercase: {id: 'admin.password.uppercase', defaultMessage: 'At least one uppercase letter'},
    number: {id: 'admin.password.number', defaultMessage: 'At least one number'},
    symbol: {id: 'admin.password.symbol', defaultMessage: 'At least one symbol (e.g. "~!@#$%^&*()")'},
    preview: {id: 'admin.password.preview', defaultMessage: 'Error message preview:'},
    attemptTitle: {id: 'admin.service.attemptTitle', defaultMessage: 'Maximum Login Attempts:'},
    attemptDescription: {id: 'admin.service.attemptDescription', defaultMessage: 'Login attempts allowed before user is locked out and required to reset password via email.'},
    passwordRequirements: {id: 'passwordRequirements', defaultMessage: 'Password Requirements:'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    [messages.minimumLength, {max: '', min: ''}],
    [messages.minimumLengthDescription, {max: '', min: ''}],
    messages.passwordMinLength,
    messages.password,
    messages.passwordRequirements,
    messages.lowercase,
    messages.uppercase,
    messages.number,
    messages.symbol,
    messages.preview,
    messages.attemptTitle,
    messages.attemptDescription,
];

const passwordErrors = defineMessages({
    passwordError: {id: 'user.settings.security.passwordError', defaultMessage: 'Must be {min}-{max} characters long.'},
    passwordErrorLowercase: {id: 'user.settings.security.passwordErrorLowercase', defaultMessage: 'Must be {min}-{max} characters long and include lowercase letters.'},
    passwordErrorLowercaseNumber: {id: 'user.settings.security.passwordErrorLowercaseNumber', defaultMessage: 'Must be {min}-{max} characters long and include lowercase letters and numbers.'},
    passwordErrorLowercaseNumberSymbol: {id: 'user.settings.security.passwordErrorLowercaseNumberSymbol', defaultMessage: 'Must be {min}-{max} characters long and include lowercase letters, numbers, and special characters.'},
    passwordErrorLowercaseSymbol: {id: 'user.settings.security.passwordErrorLowercaseSymbol', defaultMessage: 'Must be {min}-{max} characters long and include lowercase letters and special characters.'},
    passwordErrorLowercaseUppercase: {id: 'user.settings.security.passwordErrorLowercaseUppercase', defaultMessage: 'Must be {min}-{max} characters long and include both lowercase and uppercase letters.'},
    passwordErrorLowercaseUppercaseNumber: {id: 'user.settings.security.passwordErrorLowercaseUppercaseNumber', defaultMessage: 'Must be {min}-{max} characters long and include both lowercase and uppercase letters, and numbers.'},
    passwordErrorLowercaseUppercaseNumberSymbol: {id: 'user.settings.security.passwordErrorLowercaseUppercaseNumberSymbol', defaultMessage: 'Must be {min}-{max} characters long and include both lowercase and uppercase letters, numbers, and special characters.'},
    passwordErrorLowercaseUppercaseSymbol: {id: 'user.settings.security.passwordErrorLowercaseUppercaseSymbol', defaultMessage: 'Must be {min}-{max} characters long and include both lowercase and uppercase letters, and special characters.'},
    passwordErrorNumber: {id: 'user.settings.security.passwordErrorNumber', defaultMessage: 'Must be {min}-{max} characters long and include numbers.'},
    passwordErrorNumberSymbol: {id: 'user.settings.security.passwordErrorNumberSymbol', defaultMessage: 'Must be {min}-{max} characters long and include numbers and special characters.'},
    passwordErrorSymbol: {id: 'user.settings.security.passwordErrorSymbol', defaultMessage: 'Must be {min}-{max} characters long and include special characters.'},
    passwordErrorUppercase: {id: 'user.settings.security.passwordErrorUppercase', defaultMessage: 'Must be {min}-{max} characters long and include uppercase letters.'},
    passwordErrorUppercaseNumber: {id: 'user.settings.security.passwordErrorUppercaseNumber', defaultMessage: 'Must be {min}-{max} characters long and include uppercase letters, and numbers.'},
    passwordErrorUppercaseNumberSymbol: {id: 'user.settings.security.passwordErrorUppercaseNumberSymbol', defaultMessage: 'Must be {min}-{max} characters long and include uppercase letters, numbers, and special characters.'},
    passwordErrorUppercaseSymbol: {id: 'user.settings.security.passwordErrorUppercaseSymbol', defaultMessage: 'Must be {min}-{max} characters long and include uppercase letters, and special characters.'},
});

function getPasswordErrorsMessage(lowercase?: boolean, uppercase?: boolean, number?: boolean, symbol?: boolean) {
    type KeyType = keyof typeof passwordErrors;

    let key: KeyType = 'passwordError';

    if (lowercase) {
        key += 'Lowercase';
    }
    if (uppercase) {
        key += 'Uppercase';
    }
    if (number) {
        key += 'Number';
    }
    if (symbol) {
        key += 'Symbol';
    }

    return passwordErrors[key as KeyType];
}
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

        this.sampleErrorMsg = (
            <FormattedMessage
                {...getPasswordErrorsMessage(
                    props.config.PasswordSettings.Lowercase,
                    props.config.PasswordSettings.Uppercase,
                    props.config.PasswordSettings.Number,
                    props.config.PasswordSettings.Symbol,
                )}
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
            return (<FormattedMessage {...messages.passwordMinLength}/>);
        }
        return (
            <FormattedMessage
                {...getPasswordErrorsMessage(
                    this.state.passwordLowercase,
                    this.state.passwordUppercase,
                    this.state.passwordNumber,
                    this.state.passwordSymbol,
                )}
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
            <FormattedMessage {...messages.password}/>
        );
    }

    renderSettings = () => {
        return (
            <SettingsGroup>
                <div>
                    <TextSetting
                        id='passwordMinimumLength'
                        label={<FormattedMessage {...messages.minimumLength}/>}
                        placeholder={defineMessage({id: 'admin.password.minimumLengthExample', defaultMessage: 'E.g.: "5"'})}
                        helpText={
                            <FormattedMessage
                                {...messages.minimumLengthDescription}
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
                        label={<FormattedMessage {...messages.passwordRequirements}/>}
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
                                <FormattedMessage {...messages.lowercase}/>
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
                                <FormattedMessage {...messages.uppercase}/>
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
                                <FormattedMessage {...messages.number}/>
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
                                <FormattedMessage {...messages.symbol}/>
                            </label>
                        </div>
                        <div>
                            <br/>
                            <label>
                                <FormattedMessage {...messages.preview}/>
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
                            <FormattedMessage {...messages.attemptTitle}/>
                        }
                        placeholder={defineMessage({id: 'admin.service.attemptExample', defaultMessage: 'E.g.: "10"'})}
                        helpText={
                            <FormattedMessage {...messages.attemptDescription}/>
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
