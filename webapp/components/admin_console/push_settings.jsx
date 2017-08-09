// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

const PUSH_NOTIFICATIONS_OFF = 'off';
const PUSH_NOTIFICATIONS_MHPNS = 'mhpns';
const PUSH_NOTIFICATIONS_MTPNS = 'mtpns';
const PUSH_NOTIFICATIONS_CUSTOM = 'custom';

export default class PushSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.canSave = this.canSave.bind(this);

        this.handleAgreeChange = this.handleAgreeChange.bind(this);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    canSave() {
        return this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_MHPNS || this.state.agree;
    }

    handleAgreeChange(e) {
        this.setState({
            agree: e.target.checked
        });
    }

    handleChange(id, value) {
        if (id === 'pushNotificationServerType') {
            this.setState({
                agree: false
            });

            if (value === PUSH_NOTIFICATIONS_MHPNS) {
                this.setState({
                    pushNotificationServer: Constants.MHPNS
                });
            } else if (value === PUSH_NOTIFICATIONS_MTPNS) {
                this.setState({
                    pushNotificationServer: Constants.MTPNS
                });
            }
        }

        super.handleChange(id, value);
    }

    getConfigFromState(config) {
        config.EmailSettings.SendPushNotifications = this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_OFF;
        config.EmailSettings.PushNotificationServer = this.state.pushNotificationServer.trim();
        config.EmailSettings.PushNotificationContents = this.state.pushNotificationContents;

        return config;
    }

    getStateFromConfig(config) {
        let pushNotificationServerType = PUSH_NOTIFICATIONS_CUSTOM;
        let agree = false;
        if (!config.EmailSettings.SendPushNotifications) {
            pushNotificationServerType = PUSH_NOTIFICATIONS_OFF;
        } else if (config.EmailSettings.PushNotificationServer === Constants.MHPNS &&
            global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MHPNS === 'true') {
            pushNotificationServerType = PUSH_NOTIFICATIONS_MHPNS;
            agree = true;
        } else if (config.EmailSettings.PushNotificationServer === Constants.MTPNS) {
            pushNotificationServerType = PUSH_NOTIFICATIONS_MTPNS;
        }

        let pushNotificationServer = config.EmailSettings.PushNotificationServer;
        if (pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS) {
            pushNotificationServer = Constants.MTPNS;
        } else if (pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            pushNotificationServer = Constants.MHPNS;
        }

        return {
            pushNotificationServerType,
            pushNotificationServer,
            pushNotificationContents: config.EmailSettings.PushNotificationContents,
            agree
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.notifications.title'
                defaultMessage='Notification Settings'
            />
        );
    }

    renderSettings() {
        const pushNotificationServerTypes = [];
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_OFF, text: Utils.localizeMessage('admin.email.pushOff', 'Do not send push notifications')});
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MHPNS === 'true') {
            pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_MHPNS, text: Utils.localizeMessage('admin.email.mhpns', 'Use encrypted, production-quality HPNS connection to iOS and Android apps')});
        }
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_MTPNS, text: Utils.localizeMessage('admin.email.mtpns', 'Use iOS and Android apps on iTunes and Google Play with TPNS')});
        pushNotificationServerTypes.push({value: PUSH_NOTIFICATIONS_CUSTOM, text: Utils.localizeMessage('admin.email.selfPush', 'Manually enter Push Notification Service location')});

        let sendHelpText = null;
        let pushServerHelpText = null;
        if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_OFF) {
            sendHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.pushOffHelp'
                    defaultMessage='Please see <a href="https://about.mattermost.com/default-mobile-push-notifications/" target="_blank">documentation on push notifications</a> to learn more about setup options.'
                />
            );
        } else if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.mhpnsHelp'
                    defaultMessage='Download <a href="https://about.mattermost.com/mattermost-ios-app/" target="_blank">Mattermost iOS app</a> from iTunes. Download <a href="https://about.mattermost.com/mattermost-android-app/" target="_blank">Mattermost Android app</a> from Google Play. Learn more about the <a href="https://about.mattermost.com/default-hpns/" target="_blank">Mattermost Hosted Push Notification Service</a>.'
                />
            );
        } else if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MTPNS) {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.mtpnsHelp'
                    defaultMessage='Download <a href="https://about.mattermost.com/mattermost-ios-app/" target="_blank">Mattermost iOS app</a> from iTunes. Download <a href="https://about.mattermost.com/mattermost-android-app/" target="_blank">Mattermost Android app</a> from Google Play. Learn more about the <a href="https://about.mattermost.com/default-tpns/" target="_blank">Mattermost Test Push Notification Service</a>.'
                />
            );
        } else {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.easHelp'
                    defaultMessage='Learn more about compiling and deploying your own mobile apps from an <a href="https://about.mattermost.com/default-enterprise-app-store" target="_blank">Enterprise App Store</a>.'
                />
            );
        }

        let tosCheckbox;
        if (this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_MHPNS) {
            tosCheckbox = (
                <div className='form-group'>
                    <div className='col-sm-4'/>
                    <div className='col-sm-8'>
                        <input
                            type='checkbox'
                            ref='agree'
                            checked={this.state.agree}
                            onChange={this.handleAgreeChange}
                        />
                        <FormattedHTMLMessage
                            id='admin.email.agreeHPNS'
                            defaultMessage=' I understand and accept the Mattermost Hosted Push Notification Service <a href="https://about.mattermost.com/hpns-terms/" target="_blank">Terms of Service</a> and <a href="https://about.mattermost.com/hpns-privacy/" target="_blank">Privacy Policy</a>.'
                        />
                    </div>
                </div>
            );
        }

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.notifications.push'
                        defaultMessage='Mobile Push'
                    />
                }
            >
                <DropdownSetting
                    id='pushNotificationServerType'
                    values={pushNotificationServerTypes}
                    label={
                        <FormattedMessage
                            id='admin.email.pushTitle'
                            defaultMessage='Enable Push Notifications: '
                        />
                    }
                    value={this.state.pushNotificationServerType}
                    onChange={this.handleChange}
                    helpText={sendHelpText}
                />
                {tosCheckbox}
                <TextSetting
                    id='pushNotificationServer'
                    label={
                        <FormattedMessage
                            id='admin.email.pushServerTitle'
                            defaultMessage='Push Notification Server:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.email.pushServerEx', 'E.g.: "http://push-test.mattermost.com"')}
                    helpText={pushServerHelpText}
                    value={this.state.pushNotificationServer}
                    onChange={this.handleChange}
                    disabled={this.state.pushNotificationServerType !== PUSH_NOTIFICATIONS_CUSTOM}
                />
                <DropdownSetting
                    id='pushNotificationContents'
                    values={[
                        {value: 'generic_no_channel', text: Utils.localizeMessage('admin.email.genericNoChannelPushNotification', '"Send generic description with only sender name')},
                        {value: 'generic', text: Utils.localizeMessage('admin.email.genericPushNotification', 'Send generic description with sender and channel names')},
                        {value: 'full', text: Utils.localizeMessage('admin.email.fullPushNotification', 'Send full message snippet')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.email.pushContentTitle'
                            defaultMessage='Push Notification Contents:'
                        />
                    }
                    value={this.state.pushNotificationContents}
                    onChange={this.handleChange}
                    disabled={this.state.pushNotificationServerType === PUSH_NOTIFICATIONS_OFF}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.email.pushContentDesc'
                            defaultMessage='"Send generic description with only sender name" includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents.<br /><br />"Send generic description with sender and channel names" includes the name of the person who sent the message and the channel it was sent in, but not the message text.<br /><br />"Send full message snippet" includes a message excerpt in push notifications, which may contain confidential information sent in messages. If your Push Notification Service is outside your firewall, it is *highly recommended* this option only be used with an "https" protocol to encrypt the connection.'
                        />
                    }
                />
            </SettingsGroup>
        );
    }
}
