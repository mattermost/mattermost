// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import GeneratedSetting from './generated_setting.jsx';
import SettingsGroup from './settings_group.jsx';

export class SignupSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            requireEmailVerification: props.config.EmailSettings.RequireEmailVerification,
            inviteSalt: props.config.EmailSettings.InviteSalt
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.RequireEmailVerification = this.state.requireEmailVerification;
        config.EmailSettings.InviteSalt = this.state.inviteSalt;

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
        return (
            <SignupSettings
                sendEmailNotifications={this.props.config.EmailSettings.SendEmailNotifications}
                requireEmailVerification={this.state.requireEmailVerification}
                inviteSalt={this.state.inviteSalt}
                onChange={this.handleChange}
            />
        );
    }
}

export class SignupSettings extends React.Component {
    static get propTypes() {
        return {
            sendEmailNotifications: React.PropTypes.bool.isRequired,
            requireEmailVerification: React.PropTypes.bool.isRequired,
            inviteSalt: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.security.signup'
                        defaultMessage='Signup'
                    />
                }
            >
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
                    value={this.props.requireEmailVerification}
                    onChange={this.props.onChange}
                    disabled={this.props.sendEmailNotifications}
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
                            defaultMessage='Invite Salt:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.inviteSaltDescription'
                            defaultMessage='32-character salt added to signing of email invites. Randomly generated on install. Click "Re-Generate" to create new salt.'
                        />
                    }
                    value={this.props.inviteSalt}
                    onChange={this.props.onChange}
                    disabled={this.props.sendEmailNotifications}
                    disabledText={
                        <FormattedMessage
                            id='admin.security.inviteSalt.disabled'
                            defaultMessage='Invite salt cannot be changed while sending emails is disabled.'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}
