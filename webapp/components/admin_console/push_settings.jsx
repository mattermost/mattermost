// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class PushSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            sendPushNotifications: props.config.EmailSettings.SendPushNotifications,
            pushNotificationServer: props.config.EmailSettings.PushNotificationServer,
            pushNotificationContents: props.config.EmailSettings.PushNotificationContents
        });
    }

    getConfigFromState(config) {
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
            <PushSettings
                sendPushNotifications={this.state.sendPushNotifications}
                pushNotificationServer={this.state.pushNotificationServer}
                pushNotificationContents={this.state.pushNotificationContents}
                onChange={this.handleChange}
            />
        );
    }
}

export class PushSettings extends React.Component {
    static get propTypes() {
        return {
            sendPushNotifications: React.PropTypes.bool.isRequired,
            pushNotificationServer: React.PropTypes.string.isRequired,
            pushNotificationContents: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.notifications.email'
                        defaultMessage='Email'
                    />
                }
            >
                <BooleanSetting
                    id='sendPushNotifications'
                    label={
                        <FormattedMessage
                            id='admin.email.pushTitle'
                            defaultMessage='Send Push Notifications: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.pushDesc'
                            defaultMessage='Typically set to true in production. When true, Mattermost attempts to send iOS and Android push notifications through the push notification server.'
                        />
                    }
                    value={this.props.sendPushNotifications}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='pushNotificationServer'
                    label={
                        <FormattedMessage
                            id='admin.email.pushServerTitle'
                            defaultMessage='Push Notification Server:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.pushServerEx', 'E.g.: "http://push-test.mattermost.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.email.pushServerDesc'
                            defaultMessage='Location of Mattermost push notification service you can set up behind your firewall using https://github.com/mattermost/push-proxy. For testing you can use http://push-test.mattermost.com, which connects to the sample Mattermost iOS app in the public Apple AppStore. Please do not use test service for production deployments.'
                        />
                    }
                    value={this.props.pushNotificationServer}
                    onChange={this.props.onChange}
                    disabled={!this.props.sendPushNotifications}
                />
                <DropdownSetting
                    id='pushNotificationContents'
                    values={[
                        {value: 'generic', text: Utils.localizeMessage('admin.email.genericPushNotification', 'Send generic description with user and channel names')},
                        {value: 'full', text: Utils.localizeMessage('admin.email.fullPushNotification', 'Send full message snippet')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.email.pushContentTitle'
                            defaultMessage='Push Notification Contents:'
                        />
                    }
                    value={this.props.pushNotificationContents}
                    onChange={this.props.onChange}
                    disabled={!this.props.sendPushNotifications}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.email.pushContentDesc'
                            defaultMessage='Selecting "Send generic description with user and channel names" provides push notifications with generic messages, including names of users and channels but no specific details from the message text.<br /><br />
                            Selecting "Send full message snippet" sends excerpts from messages triggering notifications with specifics and may include confidential information sent in messages. If your Push Notification Service is outside your firewall, it is HIGHLY RECOMMENDED this option only be used with an "https" protocol to encrypt the connection.'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}
