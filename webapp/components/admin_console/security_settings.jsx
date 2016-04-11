// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {ConnectionSettings} from './connection_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {LoginSettings} from './login_settings.jsx';
import {PublicLinkSettings} from './public_link_settings.jsx';
import {SessionSettings} from './session_settings.jsx';
import {SignupSettings} from './signup_settings.jsx';

export default class SecuritySettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            requireEmailVerification: props.config.EmailSettings.RequireEmailVerification,
            inviteSalt: props.config.EmailSettings.InviteSalt,

            passwordResetSalt: props.config.EmailSettings.PasswordResetSalt,
            maximumLoginAttempts: props.config.ServiceSettings.MaximumLoginAttempts,
            enableMultifactorAuthentication: props.config.ServiceSettings.EnableMultifactorAuthentication,

            enablePublicLink: props.config.FileSettings.EnablePublicLink,
            publicLinkSalt: props.config.FileSettings.PublicLinkSalt,

            sessionLengthWebInDays: props.config.ServiceSettings.SessionLengthWebInDays,
            sessionLengthMobileInDays: props.config.ServiceSettings.SessionLengthMobileInDays,
            sessionLengthSSOInDays: props.config.ServiceSettings.SessionLengthSSOInDays,
            sessionCacheInMinutes: props.config.ServiceSettings.SessionCacheInMinutes,

            allowCorsFrom: props.config.ServiceSettings.AllowCorsFrom,
            enableInsecureOutgoingConnections: props.config.ServiceSettings.EnableInsecureOutgoingConnections
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.RequireEmailVerification = this.state.requireEmailVerification;
        config.EmailSettings.InviteSalt = this.state.inviteSalt;

        config.EmailSettings.PasswordResetSalt = this.state.passwordResetSalt;
        config.ServiceSettings.MaximumLoginAttempts = this.parseIntNonZero(this.state.maximumLoginAttempts);
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MFA === 'true') {
            config.ServiceSettings.EnableMultifactorAuthentication = this.state.enableMultifactorAuthentication;
        }

        config.FileSettings.EnablePublicLink = this.state.enablePublicLink;
        config.FileSettings.PublicLinkSalt = this.state.publicLinkSalt;

        config.ServiceSettings.SessionLengthWebInDays = this.parseIntNonZero(this.state.sessionLengthWebInDays);
        config.ServiceSettings.SessionLengthMobileInDays = this.parseIntNonZero(this.state.sessionLengthMobileInDays);
        config.ServiceSettings.SessionLengthSSOInDays = this.parseIntNonZero(this.state.sessionLengthSSOInDays);
        config.ServiceSettings.SessionCacheInMinutes = this.parseIntNonZero(this.state.sessionCacheInMinutes);

        config.ServiceSettings.AllowCorsFrom = this.state.allowCorsFrom;
        config.ServiceSettings.EnableInsecureOutgoingConnections = this.state.enableInsecureOutgoingConnections;

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
            <div>
                <SignupSettings
                    sendEmailNotifications={this.props.config.EmailSettings.SendEmailNotifications}
                    requireEmailVerification={this.state.requireEmailVerification}
                    inviteSalt={this.state.inviteSalt}
                    onChange={this.handleChange}
                />
                <LoginSettings
                    sendEmailNotifications={this.props.config.EmailSettings.SendEmailNotifications}
                    passwordResetSalt={this.state.passwordResetSalt}
                    maximumLoginAttempts={this.state.maximumLoginAttempts}
                    enableMultifactorAuthentication={this.state.enableMultifactorAuthentication}
                    onChange={this.handleChange}
                />
                <PublicLinkSettings
                    enablePublicLink={this.state.enablePublicLink}
                    publicLinkSalt={this.state.publicLinkSalt}
                    onChange={this.handleChange}
                />
                <SessionSettings
                    sessionLengthWebInDays={this.state.sessionLengthWebInDays}
                    sessionLengthMobileInDays={this.state.sessionLengthMobileInDays}
                    sessionLengthSSOInDays={this.state.sessionLengthSSOInDays}
                    sessionCacheInMinutes={this.state.sessionCacheInMinutes}
                    onChange={this.handleChange}
                />
                <ConnectionSettings
                    allowCorsFrom={this.state.allowCorsFrom}
                    enableInsecureOutgoingConnections={this.state.enableInsecureOutgoingConnections}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
