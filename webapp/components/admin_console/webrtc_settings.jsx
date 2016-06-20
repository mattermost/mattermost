// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import BooleanSetting from './boolean_setting.jsx';
import TextSetting from './text_setting.jsx';

export default class WebrtcSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.canSave = this.canSave.bind(this);
        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            hasErrors: false,
            enableWebrtc: props.config.WebrtcSettings.Enable,
            accountSid: props.config.WebrtcSettings.TwilioAccountSid,
            apiKey: props.config.WebrtcSettings.TwilioApiKey,
            apiSecret: props.config.WebrtcSettings.TwilioApiSecret,
            configurationProfileSid: props.config.WebrtcSettings.TwilioConfigurationProfileSid
        });
    }

    getConfigFromState(config) {
        config.WebrtcSettings.Enable = this.state.enableWebrtc;
        config.WebrtcSettings.TwilioAccountSid = this.state.accountSid;
        config.WebrtcSettings.TwilioApiKey = this.state.apiKey;
        config.WebrtcSettings.TwilioApiSecret = this.state.apiSecret;
        config.WebrtcSettings.TwilioConfigurationProfileSid = this.state.configurationProfileSid;

        return config;
    }

    canSave() {
        return (this.state.enableWebrtc === false || this.state.accountSid && this.state.apiKey && this.state.apiSecret && this.state.configurationProfileSid);
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.webrtc'
                    defaultMessage='WebRTC'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableWebrtc'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.enableTitle'
                            defaultMessage='Enable WebRTC with Twilio: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.webrtc.enableDescription'
                            defaultMessage='When true, Mattermost allows making video calls to other teammates using Twilio Service.<br /><br />To configure, set the "Account Sid", "ApiKey", "ApiSecret" and "ConfigurationProfileSid" fields to complete the options bellow.<br />To get them Sign up to your <a href="https://www.twilio.com/user/account/video" target="_blank">Twilio account</a>.'
                        />
                    }
                    value={this.state.enableWebrtc}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='accountSid'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.accountSidTitle'
                            defaultMessage='Twilio Account Sid:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.accountSidExample', 'Ex "AC556823e3d28ad704df2439ce0b0423fb"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.accountSidDescription'
                            defaultMessage='Set the Account Sid provided by Twilio.'
                        />
                    }
                    value={this.state.accountSid}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='apiKey'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.apiKeyTitle'
                            defaultMessage='Twilio Api Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.apiKeyExample', 'Ex "SKa09bb26f5bf102b19d00eb697f6de67a"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.apiKeyDescription'
                            defaultMessage='Set the Api Key provided by Twilio.'
                        />
                    }
                    value={this.state.apiKey}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='apiSecret'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.apiSecretTitle'
                            defaultMessage='Twilio Api Secret:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.apiSecretExample', 'Ex "PVRzWNN1Tg6szn7IQWvhpAvLByScWxdy"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.apiSecretDescription'
                            defaultMessage='Set the Api Secret provided by Twilio.'
                        />
                    }
                    value={this.state.apiSecret}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='configurationProfileSid'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.configurationProfileSidTitle'
                            defaultMessage='Twilio Configuration Profile Sid:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.configurationProfileSidExample', 'Ex "VSd8fde6c92a5165e1077bdada30ef0008"')}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.webrtc.configurationProfileSidDescription'
                            defaultMessage='Enter your Configuration Profile Sid provided by Twilio.<br />Configuration Profiles store configurable parameters for Video applications.'
                        />
                    }
                    value={this.state.configurationProfileSid}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
            </SettingsGroup>
        );
    }
}
