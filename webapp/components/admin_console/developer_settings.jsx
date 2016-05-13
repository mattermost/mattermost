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

        this.state = Object.assign(this.state, {
            enableTesting: props.config.ServiceSettings.EnableTesting,
            enableDeveloper: props.config.ServiceSettings.EnableDeveloper
        });
    }

    getConfigFromState(config) {
        config.ServiceSettings.EnableTesting = this.state.enableTesting;
        config.ServiceSettings.EnableDeveloper = this.state.enableDeveloper;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.developer.title'
                    defaultMessage='Developer Settings'
                />
            </h3>
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
                            defaultMessage='Enable Testing: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.testingDescription'
                            defaultMessage='(Developer Option) When true, /loadtest slash command is enabled to load test accounts and test data. Changing this will require a server restart before taking effect.'
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
                            defaultMessage='(Developer Option) When true, extra information around errors will be displayed in the UI.'
                        />
                    }
                    value={this.state.enableDeveloper}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}