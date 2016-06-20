// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import ConnectionSecurityDropdownSetting from './connection_security_dropdown_setting.jsx';
import EmailConnectionTest from './email_connection_test.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class EmailSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            sendEmailNotifications: props.config.EmailSettings.SendEmailNotifications,
            feedbackName: props.config.EmailSettings.FeedbackName,
            feedbackEmail: props.config.EmailSettings.FeedbackEmail,
            smtpUsername: props.config.EmailSettings.SMTPUsername,
            smtpPassword: props.config.EmailSettings.SMTPPassword,
            smtpServer: props.config.EmailSettings.SMTPServer,
            smtpPort: props.config.EmailSettings.SMTPPort,
            connectionSecurity: props.config.EmailSettings.ConnectionSecurity,
            enableSecurityFixAlert: props.config.ServiceSettings.EnableSecurityFixAlert
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.SendEmailNotifications = this.state.sendEmailNotifications;
        config.EmailSettings.FeedbackName = this.state.feedbackName;
        config.EmailSettings.FeedbackEmail = this.state.feedbackEmail;
        config.EmailSettings.SMTPUsername = this.state.smtpUsername;
        config.EmailSettings.SMTPPassword = this.state.smtpPassword;
        config.EmailSettings.SMTPServer = this.state.smtpServer;
        config.EmailSettings.SMTPPort = this.state.smtpPort;
        config.EmailSettings.ConnectionSecurity = this.state.connectionSecurity;
        config.ServiceSettings.EnableSecurityFixAlert = this.state.enableSecurityFixAlert;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.notifications.email'
                    defaultMessage='Email'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='sendEmailNotifications'
                    label={
                        <FormattedMessage
                            id='admin.email.notificationsTitle'
                            defaultMessage='Send Email Notifications: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.email.notificationsDescription'
                            defaultMessage='Typically set to true in production. When true, Mattermost attempts to send email notifications. Developers may set this field to false to skip email setup for faster development.<br />Setting this to true removes the Preview Mode banner (requires logging out and logging back in after setting is changed).'
                        />
                    }
                    value={this.state.sendEmailNotifications}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='feedbackName'
                    label={
                        <FormattedMessage
                            id='admin.email.notificationDisplayTitle'
                            defaultMessage='Notification Display Name:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.notificationDisplayExample', 'Ex: "Mattermost Notification", "System", "No-Reply"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.notificationDisplayDescription'
                            defaultMessage='Display name on email account used when sending notification emails from Mattermost.'
                        />
                    }
                    value={this.state.feedbackName}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='feedbackEmail'
                    label={
                        <FormattedMessage
                            id='admin.email.notificationEmailTitle'
                            defaultMessage='Notification Email Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.notificationEmailExample', 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.notificationEmailDescription'
                            defaultMessage='Email address displayed on email account used when sending notification emails from Mattermost.'
                        />
                    }
                    value={this.state.feedbackEmail}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='smtpUsername'
                    label={
                        <FormattedMessage
                            id='admin.email.smtpUsernameTitle'
                            defaultMessage='SMTP Username:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.smtpUsernameExample', 'Ex: "admin@yourcompany.com", "AKIADTOVBGERKLCBV"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.smtpUsernameDescription'
                            defaultMessage=' Obtain this credential from administrator setting up your email server.'
                        />
                    }
                    value={this.state.smtpUsername}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='smtpPassword'
                    label={
                        <FormattedMessage
                            id='admin.email.smtpPasswordTitle'
                            defaultMessage='SMTP Password:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.smtpPasswordExample', 'Ex: "yourpassword", "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.smtpPasswordDescription'
                            defaultMessage=' Obtain this credential from administrator setting up your email server.'
                        />
                    }
                    value={this.state.smtpPassword}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='smtpServer'
                    label={
                        <FormattedMessage
                            id='admin.email.smtpServerTitle'
                            defaultMessage='SMTP Server:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.smtpServerExample', 'Ex: "smtp.yourcompany.com", "email-smtp.us-east-1.amazonaws.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.smtpServerDescription'
                            defaultMessage='Location of SMTP email server.'
                        />
                    }
                    value={this.state.smtpServer}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='smtpPort'
                    label={
                        <FormattedMessage
                            id='admin.email.smtpPortTitle'
                            defaultMessage='SMTP Port:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.smtpPortExample', 'Ex: "25", "465"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.smtpPortDescription'
                            defaultMessage='Port of SMTP email server.'
                        />
                    }
                    value={this.state.smtpPort}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <ConnectionSecurityDropdownSetting
                    value={this.state.connectionSecurity}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <EmailConnectionTest
                    config={this.getConfigFromState(this.props.config)}
                    disabled={!this.state.sendEmailNotifications}
                />
                <BooleanSetting
                    id='enableSecurityFixAlert'
                    label={
                        <FormattedMessage
                            id='admin.service.securityTitle'
                            defaultMessage='Enable Security Alerts: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.securityDesc'
                            defaultMessage='When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.'
                        />
                    }
                    value={this.state.enableSecurityFixAlert}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}