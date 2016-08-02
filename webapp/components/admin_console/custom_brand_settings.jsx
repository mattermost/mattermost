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
import Constants from 'utils/constants.jsx';

export default class CustomBrandSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.TeamSettings.SiteName = this.state.siteName;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            config.TeamSettings.EnableCustomBrand = this.state.enableCustomBrand;
            config.TeamSettings.CustomBrandText = this.state.customBrandText;
            config.TeamSettings.customDescriptionText = this.state.customDescriptionText;
        }

        return config;
    }

    getStateFromConfig(config) {
        return {
            siteName: config.TeamSettings.SiteName,
            enableCustomBrand: config.TeamSettings.EnableCustomBrand,
            customBrandText: config.TeamSettings.CustomBrandText,
            customDescriptionText: config.TeamSettings.CustomDescriptionText
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.customization.customBrand'
                    defaultMessage='Custom Branding'
                />
            </h3>
        );
    }

    renderSettings() {
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
                    value={this.state.enableCustomBrand}
                    onChange={this.handleChange}
                />
            );

            enterpriseSettings.push(
                <BrandImageSetting
                    key='customBrandImage'
                    disabled={!this.state.enableCustomBrand}
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
                    value={this.state.customBrandText}
                    onChange={this.handleChange}
                    disabled={!this.state.enableCustomBrand}
                />
            );

            enterpriseSettings.push(
                <TextSetting
                    key='customDescriptionText'
                    id='customDescriptionText'
                    type='textarea'
                    label={
                        <FormattedMessage
                            id='admin.team.brandDescriptionTitle'
                            defaultMessage='Site Description'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.team.brandDescriptionHelp'
                            defaultMessage='Description of service shown in login screens and UI.'
                        />
                    }
                    value={this.state.customDescriptionText}
                    placeholder={Utils.localizeMessage('web.root.signup_info', 'All team communication in one place, searchable and accessible anywhere')}
                    onChange={this.handleChange}
                    disabled={!this.state.enableCustomBrand}
                />
            );
        }

        return (
            <SettingsGroup>
                <TextSetting
                    id='siteName'
                    label={
                        <FormattedMessage
                            id='admin.team.siteNameTitle'
                            defaultMessage='Site Name:'
                        />
                    }
                    maxLength={Constants.MAX_SITENAME_LENGTH}
                    placeholder={Utils.localizeMessage('admin.team.siteNameExample', 'Ex "Mattermost"')}
                    helpText={
                        <FormattedMessage
                            id='admin.team.siteNameDescription'
                            defaultMessage='Name of service shown in login screens and UI.'
                        />
                    }
                    value={this.state.siteName}
                    onChange={this.handleChange}
                />
                {enterpriseSettings}
            </SettingsGroup>
        );
    }
}