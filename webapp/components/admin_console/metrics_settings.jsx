// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import TextSetting from './text_setting.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

import * as Utils from 'utils/utils.jsx';

export default class MetricsSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.MetricsSettings.Enable = this.state.enable;
        config.MetricsSettings.ListenAddress = this.state.listenAddress;

        return config;
    }

    getStateFromConfig(config) {
        const settings = config.MetricsSettings;

        return {
            enable: settings.Enable,
            listenAddress: settings.ListenAddress
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.advance.metrics'
                defaultMessage='Performance Monitoring'
            />
        );
    }

    renderSettings() {
        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.Metrics === 'true';
        if (!licenseEnabled) {
            return null;
        }

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.metrics.enableTitle'
                            defaultMessage='Enable Performance Monitoring:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.metrics.enableDescription'
                            defaultMessage='When true, Mattermost will enable performance monitoring collection and profiling. Please see <a href="http://docs.mattermost.com/deployment/metrics.html" target="_blank">documentation</a> to learn more about configuring performance monitoring for Mattermost.'
                        />
                    }
                    value={this.state.enable}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='listenAddress'
                    label={
                        <FormattedMessage
                            id='admin.metrics.listenAddressTitle'
                            defaultMessage='Listen Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.metrics.listenAddressEx', 'Ex ":8067"')}
                    helpText={
                        <FormattedMessage
                            id='admin.metrics.listenAddressDesc'
                            defaultMessage='The address the server will listen on to expose performance metrics.'
                        />
                    }
                    value={this.state.listenAddress}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
