// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class EmailAuthenticationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.EmailSettings.EnableSignUpWithEmail = this.state.enableSignUpWithEmail;
        config.EmailSettings.EnableSignInWithEmail = this.state.enableSignInWithEmail;
        config.EmailSettings.EnableSignInWithUsername = this.state.enableSignInWithUsername;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableSignUpWithEmail: config.EmailSettings.EnableSignUpWithEmail,
            enableSignInWithEmail: config.EmailSettings.EnableSignInWithEmail,
            enableSignInWithUsername: config.EmailSettings.EnableSignInWithUsername
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.authentication.email'
                defaultMessage='Email'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableSignUpWithEmail'
                    label={
                        <FormattedMessage
                            id='admin.email.allowSignupTitle'
                            defaultMessage='Enable account creation with email: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowSignupDescription'
                            defaultMessage='When true, Mattermost allows team creation and account signup using email and password.  This value should be false only when you want to limit signup to a single-sign-on service like OAuth or AD/LDAP.'
                        />
                    }
                    value={this.state.enableSignUpWithEmail}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableSignInWithEmail'
                    label={
                        <FormattedMessage
                            id='admin.email.allowEmailSignInTitle'
                            defaultMessage='Enable sign-in with email: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowEmailSignInDescription'
                            defaultMessage='When true, Mattermost allows users to sign in using their email and password.'
                        />
                    }
                    value={this.state.enableSignInWithEmail}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableSignInWithUsername'
                    label={
                        <FormattedMessage
                            id='admin.email.allowUsernameSignInTitle'
                            defaultMessage='Enable sign-in with username: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowUsernameSignInDescription'
                            defaultMessage='When true, Mattermost allows users to sign in using their username and password.  This setting is typically only used when email verification is disabled.'
                        />
                    }
                    value={this.state.enableSignInWithUsername}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
