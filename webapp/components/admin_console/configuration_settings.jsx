// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import ReloadConfigButton from './reload_config.jsx';
import WebserverModeDropdownSetting from './webserver_mode_dropdown_setting.jsx';

export default class ConfigurationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        // special case for this page since we don't update AdminSettings components when the
        // stored config changes, but we want this page to update when you reload the config
        this.setState(this.getStateFromConfig(nextProps.config));
    }

    getConfigFromState(config) {
        config.ServiceSettings.SiteURL = this.state.siteURL;
        config.ServiceSettings.ListenAddress = this.state.listenAddress;
        config.ServiceSettings.WebserverMode = this.state.webserverMode;

        return config;
    }

    getStateFromConfig(config) {
        return {
            siteURL: config.ServiceSettings.SiteURL,
            listenAddress: config.ServiceSettings.ListenAddress,
            webserverMode: config.ServiceSettings.WebserverMode
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.configuration'
                    defaultMessage='Configuration'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='siteURL'
                    label={
                        <FormattedMessage
                            id='admin.service.siteURL'
                            defaultMessage='Site URL:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.siteURLExample', 'Ex "https://mattermost.example.com:1234"')}
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.siteURLDescription'
                            defaultMessage='The URL, including port number and protocol, that users will use to access Mattermost. This field can be left blank unless you are configuring email batching in <b>Notifications > Email</b>. When blank, the URL is automatically configured based on incoming traffic.'
                        />
                    }
                    value={this.state.siteURL}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='listenAddress'
                    label={
                        <FormattedMessage
                            id='admin.service.listenAddress'
                            defaultMessage='Listen Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.listenExample', 'Ex ":8065"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.listenDescription'
                            defaultMessage='The address to which to bind and listen. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065".  Changing this will require a server restart before taking effect.'
                        />
                    }
                    value={this.state.listenAddress}
                    onChange={this.handleChange}
                />
                <WebserverModeDropdownSetting
                    value={this.state.webserverMode}
                    onChange={this.handleChange}
                    disabled={false}
                />
                <ReloadConfigButton/>
            </SettingsGroup>
        );
    }
}
