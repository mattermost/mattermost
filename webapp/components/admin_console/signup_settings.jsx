// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';

export default class SignupSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.EmailSettings.RequireEmailVerification = this.state.requireEmailVerification;
        config.EmailSettings.InviteSalt = this.state.inviteSalt;
        config.TeamSettings.EnableOpenServer = this.state.enableOpenServer;

        return config;
    }

    getStateFromConfig(config) {
        return {
            requireEmailVerification: config.EmailSettings.RequireEmailVerification,
            inviteSalt: config.EmailSettings.InviteSalt,
            enableOpenServer: config.TeamSettings.EnableOpenServer
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.security.signup'
                defaultMessage='Signup'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='requireEmailVerification'
                    label={
                        <FormattedMessage
                            id='admin.email.requireVerificationTitle'
                            defaultMessage='Require Email Verification: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.requireVerificationDescription'
                            defaultMessage='Typically set to true in production. When true, Mattermost requires email verification after account creation prior to allowing login. Developers may set this field to false so skip sending verification emails for faster development.'
                        />
                    }
                    value={this.state.requireEmailVerification}
                    onChange={this.handleChange}
                    disabled={this.state.sendEmailNotifications}
                    disabledText={
                        <FormattedMessage
                            id='admin.security.requireEmailVerification.disabled'
                            defaultMessage='Email verification cannot be changed while sending emails is disabled.'
                        />
                    }
                />
                <GeneratedSetting
                    id='inviteSalt'
                    label={
                        <FormattedMessage
                            id='admin.email.inviteSaltTitle'
                            defaultMessage='Email Invite Salt:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.inviteSaltDescription'
                            defaultMessage='32-character salt added to signing of email invites. Randomly generated on install. Click "Regenerate" to create new salt.'
                        />
                    }
                    value={this.state.inviteSalt}
                    onChange={this.handleChange}
                    disabled={this.state.sendEmailNotifications}
                    disabledText={
                        <FormattedMessage
                            id='admin.security.inviteSalt.disabled'
                            defaultMessage='Invite salt cannot be changed while sending emails is disabled.'
                        />
                    }
                />
                <BooleanSetting
                    id='enableOpenServer'
                    label={
                        <FormattedMessage
                            id='admin.team.openServerTitle'
                            defaultMessage='Enable Open Server: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.team.openServerDescription'
                            defaultMessage='When true, anyone can signup for a user account on this server without the need to be invited.'
                        />
                    }
                    value={this.state.enableOpenServer}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
