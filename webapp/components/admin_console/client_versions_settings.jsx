// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class ClientVersionsSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ClientRequirements.AndroidLatestVersion = this.state.androidLatestVersion;
        config.ClientRequirements.AndroidMinVersion = this.state.androidMinVersion;
        config.ClientRequirements.DesktopLatestVersion = this.state.desktopLatestVersion;
        config.ClientRequirements.DesktopMinVersion = this.state.desktopMinVersion;
        config.ClientRequirements.IosLatestVersion = this.state.iosLatestVersion;
        config.ClientRequirements.IosMinVersion = this.state.iosMinVersion;

        return config;
    }

    getStateFromConfig(config) {
        return {
            androidLatestVersion: config.ClientRequirements.AndroidLatestVersion,
            androidMinVersion: config.ClientRequirements.AndroidMinVersion,
            desktopLatestVersion: config.ClientRequirements.DesktopLatestVersion,
            desktopMinVersion: config.ClientRequirements.DesktopMinVersion,
            iosLatestVersion: config.ClientRequirements.IosLatestVersion,
            iosMinVersion: config.ClientRequirements.IosMinVersion
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.security.client_versions'
                    defaultMessage='Client Versions'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='androidLatestVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.androidLatestVersion'
                            defaultMessage='Latest Android Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.androidLatestVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.androidLatestVersion'
                            defaultMessage='Currnet android version'
                        />
                    }
                    value={this.state.androidLatestVersion}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='androidMinVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.androidMinVersion'
                            defaultMessage='Minimum Android Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.androidMinVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.androidMinVersion'
                            defaultMessage='The minimum compliant andriod version'
                        />
                    }
                    value={this.state.androidMinVersion}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='desktopLatestVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.desktopLatestVersion'
                            defaultMessage='Latest Desktop Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.desktopLatestVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.desktopLatestVersion'
                            defaultMessage='Currnet desktop version'
                        />
                    }
                    value={this.state.desktopLatestVersion}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='desktopMinVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.desktopMinVersion'
                            defaultMessage='Minimum Destop Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.desktopMinVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.desktopMinVersion'
                            defaultMessage='The minimum compliant desktop version'
                        />
                    }
                    value={this.state.desktopMinVersion}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='iosLatestVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.iosLatestVersion'
                            defaultMessage='Latest IOS Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.iosLatestVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.iosLatestVersion'
                            defaultMessage='Latest IOS version'
                        />
                    }
                    value={this.state.iosLatestVersion}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='iosMinVersion'
                    label={
                        <FormattedMessage
                            id='admin.client_versions.iosMinVersion'
                            defaultMessage='Minimum IOS Version'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.client_versions.iosMinVersion', 'X.X.X')}
                    helpText={
                        <FormattedMessage
                            id='admin.client_versions.iosMinVersion'
                            defaultMessage='The minimum compliant IOS version'
                        />
                    }
                    value={this.state.iosMinVersion}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
