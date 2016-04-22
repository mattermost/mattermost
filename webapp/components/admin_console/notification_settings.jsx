// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {EmailSettings} from './email_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {PushSettings} from './push_settings.jsx';

export default class NotificationSettings extends AdminSettings {
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
            enableSecurityFixAlert: props.config.ServiceSettings.EnableSecurityFixAlert,

            sendPushNotifications: props.config.EmailSettings.SendPushNotifications,
            pushNotificationServer: props.config.EmailSettings.PushNotificationServer,
            pushNotificationContents: props.config.EmailSettings.PushNotificationContents
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
        config.EmailSettings.EnableSecurityFixAlert = this.state.enableSecurityFixAlert;

        config.EmailSettings.SendPushNotifications = this.state.sendPushNotifications;
        config.EmailSettings.PushNotificationServer = this.state.PushNotificationServer;
        config.EmailSettings.PushNotificationContents = this.state.pushNotificationContents;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.notifications.title'
                    defaultMessage='Notification Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <div>
                <EmailSettings
                    sendEmailNotifications={this.state.sendEmailNotifications}
                    feedbackName={this.state.feedbackName}
                    feedbackEmail={this.state.feedbackEmail}
                    smtpUsername={this.state.smtpUsername}
                    smtpPassword={this.state.smtpPassword}
                    smtpServer={this.state.smtpServer}
                    smtpPort={this.state.smtpPort}
                    connectionSecurity={this.state.connectionSecurity}
                    enableSecurityFixAlert={this.state.enableSecurityFixAlert}
                    onChange={this.handleChange}
                />
                <PushSettings
                    sendPushNotifications={this.state.sendPushNotifications}
                    pushNotificationServer={this.state.pushNotificationServer}
                    pushNotificationContents={this.state.pushNotificationContents}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
