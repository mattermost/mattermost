// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class DeveloperSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableTesting = this.state.enableTesting;
        config.ServiceSettings.EnableDeveloper = this.state.enableDeveloper;
        config.ServiceSettings.AllowedUntrustedInternalConnections = this.state.allowedUntrustedInternalConnections;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableTesting: config.ServiceSettings.EnableTesting,
            enableDeveloper: config.ServiceSettings.EnableDeveloper,
            allowedUntrustedInternalConnections: config.ServiceSettings.AllowedUntrustedInternalConnections
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.developer.title'
                defaultMessage='Developer Settings'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableTesting'
                    label={
                        <FormattedMessage
                            id='admin.service.testingTitle'
                            defaultMessage='Enable Testing Commands: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.testingDescription'
                            defaultMessage='When true, /test slash command is enabled to load test accounts, data and text formatting. Changing this requires a server restart before taking effect.'
                        />
                    }
                    value={this.state.enableTesting}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableDeveloper'
                    label={
                        <FormattedMessage
                            id='admin.service.developerTitle'
                            defaultMessage='Enable Developer Mode: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.developerDesc'
                            defaultMessage='When true, JavaScript errors are shown in a purple bar at the top of the user interface. Not recommended for use in production. '
                        />
                    }
                    value={this.state.enableDeveloper}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='allowedUntrustedInternalConnections'
                    label={
                        <FormattedMessage
                            id='admin.service.internalConnectionsTitle'
                            defaultMessage='Allow untrusted internal connections to: '
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.internalConnectionsEx', 'webhooks.internal.example.com 127.0.0.1 10.0.16.0/28')}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.internalConnectionsDesc'
                            defaultMessage='In testing environments, such as when developing integrations locally on a development machine, use this setting to specify domains, IP addresses, or CIDR notations to allow internal connections. <b>Not recommended for use in production</b>, since this can allow a user to extract confidential data from your server or internal network.<br /><br />By default, user-supplied URLs such as those used for Open Graph metadata, webhooks, or slash commands will not be allowed to connect to reserved IP addresses including loopback or link-local addresses used for internal networks. Push notification, OAuth 2.0 and WebRTC server URLs are trusted and not affected by this setting.'
                        />
                    }
                    value={this.state.allowedUntrustedInternalConnections}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
