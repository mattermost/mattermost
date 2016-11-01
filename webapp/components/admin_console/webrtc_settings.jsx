// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
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

        this.canSave = this.canSave.bind(this);
        this.handleAgreeChange = this.handleAgreeChange.bind(this);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
    }

    canSave() {
        return !this.state.enableWebrtc || this.state.agree;
    }

    handleAgreeChange(e) {
        this.setState({
            agree: e.target.checked
        });
    }

    getConfigFromState(config) {
        config.WebrtcSettings.Enable = this.state.enableWebrtc;
        config.WebrtcSettings.GatewayWebsocketUrl = this.state.gatewayWebsocketUrl;
        config.WebrtcSettings.GatewayAdminUrl = this.state.gatewayAdminUrl;
        config.WebrtcSettings.GatewayAdminSecret = this.state.gatewayAdminSecret;
        config.WebrtcSettings.StunURI = this.state.stunURI;
        config.WebrtcSettings.TurnURI = this.state.turnURI;
        config.WebrtcSettings.TurnUsername = this.state.turnUsername;
        config.WebrtcSettings.TurnSharedKey = this.state.turnSharedKey;

        return config;
    }

    getStateFromConfig(config) {
        const settings = config.WebrtcSettings;

        return {
            hasErrors: false,
            enableWebrtc: settings.Enable,
            gatewayWebsocketUrl: settings.GatewayWebsocketUrl,
            gatewayAdminUrl: settings.GatewayAdminUrl,
            gatewayAdminSecret: settings.GatewayAdminSecret,
            stunURI: settings.StunURI,
            turnURI: settings.TurnURI,
            turnUsername: settings.TurnUsername,
            turnSharedKey: settings.TurnSharedKey,
            agree: settings.Enable
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.webrtc'
                    defaultMessage='Mattermost WebRTC (Beta)'
                />
            </h3>
        );
    }

    renderSettings() {
        const tosCheckbox = (
            <div className='form-group'>
                <div className='col-sm-4'/>
                <div className='col-sm-8'>
                    <input
                        type='checkbox'
                        ref='agree'
                        checked={this.state.agree}
                        onChange={this.handleAgreeChange}
                        disabled={!this.state.enableWebrtc}
                    />
                    <FormattedHTMLMessage
                        id='admin.webrtc.agree'
                        defaultMessage=' I understand and accept the Mattermost Hosted WebRTC Service <a href="https://about.mattermost.com/webrtc-terms/" target="_blank">Terms of Service</a> and <a href="https://about.mattermost.com/webrtc-privacy/" target="_blank">Privacy Policy</a>.'
                    />
                </div>
            </div>
        );

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableWebrtc'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.enableTitle'
                            defaultMessage='Enable Mattermost WebRTC: '
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.webrtc.enableDescription'
                            defaultMessage='When true, Mattermost allows making <strong>one-on-one</strong> video calls. WebRTC calls are available on Chrome, Firefox and Mattermost Desktop Apps.'
                        />
                    }
                    value={this.state.enableWebrtc}
                    onChange={this.handleChange}
                />
                {tosCheckbox}
                <TextSetting
                    id='gatewayWebsocketUrl'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.gatewayWebsocketUrlTitle'
                            defaultMessage='Gateway Websocket URL:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.gatewayWebsocketUrlExample', 'Ex "wss://webrtc.mattermost.com:8189"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.gatewayWebsocketUrlDescription'
                            defaultMessage='Enter wss://<mattermost-webrtc-gateway-url>:<port>. Make sure you use WS or WSS in your URL depending on your server configuration.
                            This is the websocket used to signal and establish communication between the peers.'
                        />
                    }
                    value={this.state.gatewayWebsocketUrl}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='gatewayAdminUrl'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.gatewayAdminUrlTitle'
                            defaultMessage='Gateway Admin URL:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.gatewayAdminUrlExample', 'Ex "https://webrtc.mattermost.com:7089/admin"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.gatewayAdminUrlDescription'
                            defaultMessage='Enter https://<mattermost-webrtc-gateway-url>:<port>/admin. Make sure you use HTTP or HTTPS in your URL depending on your server configuration.
                            Mattermost WebRTC uses this URL to obtain valid tokens for each peer to establish the connection.'
                        />
                    }
                    value={this.state.gatewayAdminUrl}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='gatewayAdminSecret'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.gatewayAdminSecretTitle'
                            defaultMessage='Gateway Admin Secret:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.gatewayAdminSecretExample', 'Ex "PVRzWNN1Tg6szn7IQWvhpAvLByScWxdy"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.gatewayAdminSecretDescription'
                            defaultMessage='Enter your admin secret password to access the Gateway Admin URL.'
                        />
                    }
                    value={this.state.gatewayAdminSecret}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='stunURI'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.stunUriTitle'
                            defaultMessage='STUN URI:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.stunUriExample', 'Ex "stun:webrtc.mattermost.com:5349"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.stunUriDescription'
                            defaultMessage='Enter your STUN URI as stun:<your-stun-url>:<port>. STUN is a standardized network protocol to allow an end host to assist devices to access its public IP address if it is located behind a NAT.'
                        />
                    }
                    value={this.state.stunURI}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='turnURI'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.turnUriTitle'
                            defaultMessage='TURN URI:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.turnUriExample', 'Ex "turn:webrtc.mattermost.com:5349"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.turnUriDescription'
                            defaultMessage='Enter your TURN URI as turn:<your-turn-url>:<port>. TURN is a standardized network protocol to allow an end host to assist devices to establish a connection by using a relay public IP address if it is located behind a symmetric NAT.'
                        />
                    }
                    value={this.state.turnURI}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc}
                />
                <TextSetting
                    id='turnUsername'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.turnUsernameTitle'
                            defaultMessage='TURN Username:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.turnUsernameExample', 'Ex "myusername"')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.turnUsernameDescription'
                            defaultMessage='Enter your TURN Server Username.'
                        />
                    }
                    value={this.state.turnUsername}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc || !this.state.turnURI}
                />
                <TextSetting
                    id='turnSharedKey'
                    label={
                        <FormattedMessage
                            id='admin.webrtc.turnSharedKeyTitle'
                            defaultMessage='TURN Shared Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.webrtc.turnSharedKeyExample', 'Ex "bXdkOWQxc3d0Ynk3emY5ZmsxZ3NtazRjaWg="')}
                    helpText={
                        <FormattedMessage
                            id='admin.webrtc.turnSharedKeyDescription'
                            defaultMessage='Enter your TURN Server Shared Key. This is used to created dynamic passwords to establish the connection. Each password is valid for a short period of time.'
                        />
                    }
                    value={this.state.turnSharedKey}
                    onChange={this.handleChange}
                    disabled={!this.state.enableWebrtc || !this.state.turnURI}
                />
            </SettingsGroup>
        );
    }
}
