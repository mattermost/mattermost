// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {LegalAndSupportSettings} from './legal_and_support_settings.jsx';
import {WhiteLabelingSettings} from './white_labeling_settings.jsx';

export default class CustomizationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            siteName: props.config.TeamSettings.SiteName,
            enableCustomBrand: props.config.TeamSettings.EnableCustomBrand,
            customBrandText: props.config.TeamSettings.CustomBrandText,

            termsOfServiceLink: props.config.SupportSettings.TermsOfServiceLink,
            privacyPolicyLink: props.config.SupportSettings.PrivacyPolicyLink,
            aboutLink: props.config.SupportSettings.AboutLink,
            helpLink: props.config.SupportSettings.HelpLink,
            reportAProblemLink: props.config.SupportSettings.ReportAProblemLink,
            supportEmail: props.config.SupportSettings.SupportEmail
        });
    }

    getConfigFromState(config) {
        config.TeamSettings.SiteName = this.state.siteName;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            config.TeamSettings.EnableCustomBrand = this.state.enableCustomBrand;
            config.TeamSettings.CustomBrandText = this.state.customBrandText;
        }

        config.SupportSettings.TermsOfServiceLink = this.state.termsOfServiceLink;
        config.SupportSettings.PrivacyPolicyLink = this.state.privacyPolicyLink;
        config.SupportSettings.AboutLink = this.state.aboutLink;
        config.SupportSettings.HelpLink = this.state.helpLink;
        config.SupportSettings.ReportAProblemLink = this.state.reportAProblemLink;
        config.SupportSettings.SupportEmail = this.state.supportEmail;

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
            <div>
                <WhiteLabelingSettings
                    siteName={this.state.siteName}
                    enableCustomBrand={this.state.enableCustomBrand}
                    customBrandText={this.state.customBrandText}
                    onChange={this.handleChange}
                />
                <LegalAndSupportSettings
                    termsOfServiceLink={this.state.termsOfServiceLink}
                    privacyPolicyLink={this.state.privacyPolicyLink}
                    aboutLink={this.state.aboutLink}
                    helpLink={this.state.helpLink}
                    reportAProblemLink={this.state.reportAProblemLink}
                    supportEmail={this.state.supportEmail}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
