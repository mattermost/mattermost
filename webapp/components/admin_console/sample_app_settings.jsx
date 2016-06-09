// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {localizeMessage} from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class SampleAppSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.canSave = this.canSave.bind(this);
        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enable: props.config.SampleAppSettings.Enable,
            appUrl: props.config.SampleAppSettings.AppUrl,
            iconUrl: props.config.SampleAppSettings.IconUrl,
            name: props.config.SampleAppSettings.AppName,
            displayName: props.config.SampleAppSettings.AppDisplayName
        });
    }

    getConfigFromState(config) {
        config.SampleAppSettings.Enable = this.state.enable;
        config.SampleAppSettings.AppUrl = this.state.appUrl;
        config.SampleAppSettings.IconUrl = this.state.iconUrl;
        config.SampleAppSettings.AppName = this.state.name;
        config.SampleAppSettings.AppDisplayName = this.state.displayName;

        return config;
    }

    canSave() {
        if (this.state.enable) {
            return (this.state.appUrl && this.state.displayName);
        }

        return true;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.integrations.title'
                    defaultMessage='Integrations'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.sample_app.header'
                        defaultMessage='Sample App'
                    />
                }
            >
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.sample_app.enableTitle'
                            defaultMessage='Enable Sample App:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.sample_app.enableDescription'
                            defaultMessage='When true, a Sample App for the App Center can be loaded from the main menu.'
                        />
                    }
                    value={this.state.enable}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='name'
                    label={
                        <FormattedMessage
                            id='admin.sample_app.nameTitle'
                            defaultMessage='App Namespace:'
                        />
                    }
                    placeholder={localizeMessage('admin.sample_app.nameExample', 'com.example.my-app')}
                    helpText={
                        <FormattedMessage
                            id='admin.sample_app.nameDescription'
                            defaultMessage='Enter the namespace of your app. This namespace will be used as the id for the iframe where the app is loaded'
                        />
                    }
                    value={this.state.name}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <TextSetting
                    id='displayName'
                    label={
                        <FormattedMessage
                            id='admin.sample_app.displayNameTitle'
                            defaultMessage='* App Display Name:'
                        />
                    }
                    placeholder={localizeMessage('admin.sample_app.displayNameExample', 'My first Mattermost App')}
                    helpText={
                        <FormattedMessage
                            id='admin.sample_app.displayNameDescription'
                            defaultMessage='Enter the display name of your app. This will be used in the main menu, use a name that people can recognize easily'
                        />
                    }
                    value={this.state.displayName}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <TextSetting
                    id='appUrl'
                    label={
                        <FormattedMessage
                            id='admin.sample_app.appUrlTitle'
                            defaultMessage='* App URL:'
                        />
                    }
                    placeholder={localizeMessage('admin.sample_app.appUrlExample', 'Ex "https://my-app.example.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sample_app.appUrlDescription'
                            defaultMessage='Enter the URL with the entry point to load the app.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.state.appUrl}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
                <TextSetting
                    id='iconUrl'
                    label={
                        <FormattedMessage
                            id='admin.sample_app.iconUrlTitle'
                            defaultMessage='Icon URL:'
                        />
                    }
                    placeholder={localizeMessage('admin.sample_app.iconUrlExample', 'Ex "https://my-app.example.com/app-icon.png"')}
                    helpText={
                        <FormattedMessage
                            id='admin.sample_app.iconUrlDescription'
                            defaultMessage='Enter the URL for app icon, this icon will be shown later on in the App Center.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.state.iconUrl}
                    onChange={this.handleChange}
                    disabled={!this.state.enable}
                />
            </SettingsGroup>
        );
    }
}