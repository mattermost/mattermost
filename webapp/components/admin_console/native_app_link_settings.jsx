// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class NativeAppLinkSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.NativeAppSettings.AppDownloadLink = this.state.appDownloadLink;
        config.NativeAppSettings.AndroidAppDownloadLink = this.state.androidAppDownloadLink;
        config.NativeAppSettings.IosAppDownloadLink = this.state.iosAppDownloadLink;

        return config;
    }

    getStateFromConfig(config) {
        return {
            appDownloadLink: config.NativeAppSettings.AppDownloadLink,
            androidAppDownloadLink: config.NativeAppSettings.AndroidAppDownloadLink,
            iosAppDownloadLink: config.NativeAppSettings.IosAppDownloadLink
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.customization.nativeAppLinks'
                defaultMessage='Mattermost App Links'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='appDownloadLink'
                    label={
                        <FormattedMessage
                            id='admin.customization.appDownloadLinkTitle'
                            defaultMessage='Mattermost Apps Download Page Link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.customization.appDownloadLinkDesc'
                            defaultMessage='Add a link to a download page for the Mattermost apps. When a link is present, an option to "Download Mattermost Apps" will be added in the Main Menu so users can find the download page. Leave this field blank to hide the option from the Main Menu.'
                        />
                    }
                    value={this.state.appDownloadLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='androidAppDownloadLink'
                    label={
                        <FormattedMessage
                            id='admin.customization.androidAppDownloadLinkTitle'
                            defaultMessage='Android App Download Link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.customization.androidAppDownloadLinkDesc'
                            defaultMessage='Add a link to download the Android app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.'
                        />
                    }
                    value={this.state.androidAppDownloadLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='iosAppDownloadLink'
                    label={
                        <FormattedMessage
                            id='admin.customization.iosAppDownloadLinkTitle'
                            defaultMessage='iOS App Download Link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.customization.iosAppDownloadLinkDesc'
                            defaultMessage='Add a link to download the iOS app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.'
                        />
                    }
                    value={this.state.iosAppDownloadLink}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
