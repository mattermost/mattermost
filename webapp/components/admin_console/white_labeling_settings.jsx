// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import BrandImageSetting from './brand_image_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class WhiteLabelingSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            siteName: props.config.TeamSettings.SiteName,
            enableCustomBrand: props.config.TeamSettings.EnableCustomBrand,
            customBrandText: props.config.TeamSettings.CustomBrandText
        });
    }

    getConfigFromState(config) {
        config.TeamSettings.SiteName = this.state.siteName;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            config.TeamSettings.EnableCustomBrand = this.state.enableCustomBrand;
            config.TeamSettings.CustomBrandText = this.state.customBrandText;
        }

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.customization.title'
                    defaultMessage='Customization Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <WhiteLabelingSettings
                siteName={this.state.siteName}
                enableCustomBrand={this.state.enableCustomBrand}
                customBrandText={this.state.customBrandText}
                onChange={this.handleChange}
            />
        );
    }
}

export class WhiteLabelingSettings extends React.Component {
    static get propTypes() {
        return {
            siteName: React.PropTypes.string.isRequired,
            enableCustomBrand: React.PropTypes.bool.isRequired,
            customBrandText: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        const enterpriseSettings = [];
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            enterpriseSettings.push(
                <BooleanSetting
                    key='enableCustomBrand'
                    id='enableCustomBrand'
                    label={
                        <FormattedMessage
                            id='admin.team.brandTitle'
                            defaultMessage='Enable Custom Branding: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.team.brandDesc'
                            defaultMessage='Enable custom branding to show an image of your choice, uploaded below, and some help text, written below, on the login page.'
                        />
                    }
                    value={this.props.enableCustomBrand}
                    onChange={this.props.onChange}
                />
            );

            enterpriseSettings.push(
                <BrandImageSetting
                    key='customBrandImage'
                    disabled={!this.props.enableCustomBrand}
                />
            );

            enterpriseSettings.push(
                <TextSetting
                    key='customBrandText'
                    id='customBrandText'
                    type='textarea'
                    label={
                        <FormattedMessage
                            id='admin.team.brandTextTitle'
                            defaultMessage='Custom Brand Text:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.team.brandTextDescription'
                            defaultMessage='The custom branding Markdown-formatted text you would like to appear below your custom brand image on your login sreen.'
                        />
                    }
                    value={this.props.customBrandText}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableCustomBrand}
                />
            );
        }

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.customization.whiteLabeling'
                        defaultMessage='White Labeling'
                    />
                }
            >
                <TextSetting
                    id='siteName'
                    label={
                        <FormattedMessage
                            id='admin.team.siteNameTitle'
                            defaultMessage='Site Name:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.team.siteNameExample', 'Ex "Mattermost"')}
                    helpText={
                        <FormattedMessage
                            id='admin.team.siteNameDescription'
                            defaultMessage='Name of service shown in login screens and UI.'
                        />
                    }
                    value={this.props.siteName}
                    onChange={this.props.onChange}
                />
                {enterpriseSettings}
            </SettingsGroup>
        );
    }
}
