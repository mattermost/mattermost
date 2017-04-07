// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export default class DeveloperSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableTesting = this.state.enableTesting;
        config.ServiceSettings.EnableDeveloper = this.state.enableDeveloper;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableTesting: config.ServiceSettings.EnableTesting,
            enableDeveloper: config.ServiceSettings.EnableDeveloper
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
                            defaultMessage='When true, /loadtest slash command is enabled to load test accounts, data and text formatting. Changing this requires a server restart before taking effect.'
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
                            defaultMessage='When true, JavaScript errors are shown in a red bar at the top of the user interface. Not recommended for use in production. '
                        />
                    }
                    value={this.state.enableDeveloper}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
