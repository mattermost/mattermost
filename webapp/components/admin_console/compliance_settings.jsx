// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class ComplianceSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ComplianceSettings.Enable = this.state.enable;
        config.ComplianceSettings.Directory = this.state.directory;
        config.ComplianceSettings.EnableDaily = this.state.enableDaily;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enable: config.ComplianceSettings.Enable,
            directory: config.ComplianceSettings.Directory,
            enableDaily: config.ComplianceSettings.EnableDaily
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.compliance.title'
                    defaultMessage='Compliance Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.Compliance === 'true';

        let bannerContent;
        if (!licenseEnabled) {
            bannerContent = (
                <div className='banner warning'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='admin.compliance.noLicense'
                            defaultMessage='<h4 class="banner__heading">Note:</h4><p>Compliance is an enterprise feature. Your current license does not support Compliance. Click <a href="http://mattermost.com"target="_blank">here</a> for information and pricing on enterprise licenses.</p>'
                        />
                    </div>
                </div>
            );
        }

        return (
            <SettingsGroup>
                {bannerContent}
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.compliance.enableTitle'
                            defaultMessage='Enable Compliance Reporting:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.compliance.enableDesc'
                            defaultMessage='When true, Mattermost allows compliance reporting from the <strong>Compliance and Auditing</strong> tab. See <a href="https://docs.mattermost.com/administration/compliance.html" target="_blank">documentation</a> to learn more.'
                        />
                    }
                    value={this.state.enable}
                    onChange={this.handleChange}
                    disabled={!licenseEnabled}
                />
                <TextSetting
                    id='directory'
                    label={
                        <FormattedMessage
                            id='admin.compliance.directoryTitle'
                            defaultMessage='Compliance Report Directory:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.maxOpenExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.compliance.directoryDescription'
                            defaultMessage='Directory to which compliance reports are written. If blank, will be set to ./data/.'
                        />
                    }
                    value={this.state.directory}
                    onChange={this.handleChange}
                    disabled={!licenseEnabled || !this.state.enable}
                />
                <BooleanSetting
                    id='enableDaily'
                    label={
                        <FormattedMessage
                            id='admin.compliance.enableDailyTitle'
                            defaultMessage='Enable Daily Report:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.compliance.enableDailyDesc'
                            defaultMessage='When true, Mattermost will generate a daily compliance report.'
                        />
                    }
                    value={this.state.enableDaily}
                    onChange={this.handleChange}
                    disabled={!licenseEnabled || !this.state.enable}
                />
            </SettingsGroup>
        );
    }
}
