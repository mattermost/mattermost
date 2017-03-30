// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {ConnectionSecurityDropdownSettingEmail} from './connection_security_dropdown_setting.jsx';
import EmailConnectionTest from './email_connection_test.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class EmailSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.EmailSettings.SendEmailNotifications = this.state.sendEmailNotifications;
        config.EmailSettings.FeedbackName = this.state.feedbackName;
        config.EmailSettings.FeedbackEmail = this.state.feedbackEmail;
        config.EmailSettings.FeedbackOrganization = this.state.feedbackOrganization;
        config.EmailSettings.SMTPUsername = this.state.smtpUsername;
        config.EmailSettings.SMTPPassword = this.state.smtpPassword;
        config.EmailSettings.SMTPServer = this.state.smtpServer;
        config.EmailSettings.SMTPPort = this.state.smtpPort;
        config.EmailSettings.ConnectionSecurity = this.state.connectionSecurity;
        config.EmailSettings.EnableEmailBatching = this.state.enableEmailBatching;
        config.ServiceSettings.EnableSecurityFixAlert = this.state.enableSecurityFixAlert;

        return config;
    }

    getStateFromConfig(config) {
        return {
            sendEmailNotifications: config.EmailSettings.SendEmailNotifications,
            feedbackName: config.EmailSettings.FeedbackName,
            feedbackEmail: config.EmailSettings.FeedbackEmail,
            feedbackOrganization: config.EmailSettings.FeedbackOrganization,
            smtpUsername: config.EmailSettings.SMTPUsername,
            smtpPassword: config.EmailSettings.SMTPPassword,
            smtpServer: config.EmailSettings.SMTPServer,
            smtpPort: config.EmailSettings.SMTPPort,
            connectionSecurity: config.EmailSettings.ConnectionSecurity,
            enableEmailBatching: config.EmailSettings.EnableEmailBatching,
            enableSecurityFixAlert: config.ServiceSettings.EnableSecurityFixAlert
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.notifications.email'
                defaultMessage='Email'
            />
        );
    }

    renderSettings() {
        let enableEmailBatchingDisabledText = null;

        if (this.props.config.ClusterSettings.Enable) {
            enableEmailBatchingDisabledText = (
                <span
                    key='admin.email.enableEmailBatching.clusterEnabled'
                    className='help-text'
                >
                    <FormattedHTMLMessage
                        id='admin.email.enableEmailBatching.clusterEnabled'
                        defaultMessage='Email batching cannot be enabled unless the SiteURL is configured in <b>Configuration > SiteURL</b>.'
                    />
                </span>
            );
        } else if (!this.props.config.ServiceSettings.SiteURL) {
            enableEmailBatchingDisabledText = (
                <span
                    key='admin.email.enableEmailBatching.siteURL'
                    className='help-text'
                >
                    <FormattedHTMLMessage
                        id='admin.email.enableEmailBatching.siteURL'
                        defaultMessage='Email batching cannot be enabled unless the SiteURL is configured in <b>Configuration > SiteURL</b>.'
                    />
                </span>
            );
        }

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='sendEmailNotifications'
                    label={
                        <FormattedMessage
                            id='admin.email.notificationsTitle'
                            defaultMessage='Enable Email Notifications: '
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
                <BooleanSetting
                    id='enableEmailBatching'
                    label={
                        <FormattedMessage
                            id='admin.email.enableEmailBatchingTitle'
                            defaultMessage='Enable Email Batching: '
                        />
                    }
                    helpText={[
                        <FormattedHTMLMessage
                            key='admin.email.enableEmailBatchingDesc'
                            id='admin.email.enableEmailBatchingDesc'
                            defaultMessage='When true, users can have email notifications for multiple direct messages and mentions combined into a single email, configurable in <b>Account Settings > Notifications</b>.'
                        />,
                        enableEmailBatchingDisabledText
                    ]}
                    value={this.state.enableEmailBatching && !this.props.config.ClusterSettings.Enable && this.props.config.ServiceSettings.SiteURL}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications || this.props.config.ClusterSettings.Enable || !this.props.config.ServiceSettings.SiteURL}
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
                            defaultMessage='Notification From Address:'
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
                    id='feedbackOrganization'
                    label={
                        <FormattedMessage
                            id='admin.email.notificationOrganization'
                            defaultMessage='Notification Footer Mailing Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.notificationOrganizationExample', 'Ex: "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.notificationOrganizationDescription'
                            defaultMessage='Organization name and address displayed on email notifications from Mattermost, such as "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA". If the field is left empty, the organization name and address will not be displayed.'
                        />
                    }
                    value={this.state.feedbackOrganization}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <TextSetting
                    id='smtpUsername'
                    label={
                        <FormattedMessage
                            id='admin.email.smtpUsernameTitle'
                            defaultMessage='SMTP Server Username:'
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
                            defaultMessage='SMTP Server Password:'
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
                            defaultMessage='SMTP Server Port:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.smtpPortExample', 'Ex: "25", "465", "587"')}
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
                <ConnectionSecurityDropdownSettingEmail
                    value={this.state.connectionSecurity}
                    onChange={this.handleChange}
                    disabled={!this.state.sendEmailNotifications}
                />
                <EmailConnectionTest
                    config={this.props.config}
                    getConfigFromState={this.getConfigFromState}
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
