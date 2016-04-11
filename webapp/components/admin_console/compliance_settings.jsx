// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class ComplianceSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enable: props.config.ComplianceSettings.Enable,
            directory: props.config.ComplianceSettings.Directory,
            enableDaily: props.config.ComplianceSettings.EnableDaily
        });
    }

    getConfigFromState(config) {
        config.ComplianceSettings.Enable = this.state.enable;
        config.ComplianceSettings.Directory = this.state.directory;
        config.ComplianceSettings.EnableDaily = this.state.enableDaily;

        return config;
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
        return (
            <ComplianceSettings
                enable={this.state.enable}
                directory={this.state.directory}
                enableDaily={this.state.enableDaily}
                onChange={this.handleChange}
            />
        );
    }
}

export class ComplianceSettings extends React.Component {
    static get propTypes() {
        return {
            enable: React.PropTypes.bool.isRequired,
            directory: React.PropTypes.string.isRequired,
            enableDaily: React.PropTypes.bool.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
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
                            defaultMessage='Enable Compliance:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.compliance.enableDesc'
                            defaultMessage='When true, Mattermost allows compliance reporting'
                        />
                    }
                    value={this.props.enable}
                    onChange={this.props.onChange}
                    disabled={!licenseEnabled}
                />
                <TextSetting
                    id='directory'
                    label={
                        <FormattedMessage
                            id='admin.compliance.directoryTitle'
                            defaultMessage='Compliance Directory Location:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.sql.maxOpenExample', 'Ex "10"')}
                    helpText={
                        <FormattedMessage
                            id='admin.compliance.directoryDescription'
                            defaultMessage='Directory to which compliance reports are written. If blank, will be set to ./data/.'
                        />
                    }
                    value={this.props.directory}
                    onChange={this.props.onChange}
                    disabled={!licenseEnabled || !this.props.enable}
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
                    value={this.props.enableDaily}
                    onChange={this.props.onChange}
                    disabled={!licenseEnabled || !this.props.enable}
                />
            </SettingsGroup>
        );
    }
}