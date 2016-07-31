// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class LegalAndSupportSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.SupportSettings.TermsOfServiceLink = this.state.termsOfServiceLink;
        config.SupportSettings.PrivacyPolicyLink = this.state.privacyPolicyLink;
        config.SupportSettings.AboutLink = this.state.aboutLink;
        config.SupportSettings.HelpLink = this.state.helpLink;
        config.SupportSettings.ReportAProblemLink = this.state.reportAProblemLink;
        config.SupportSettings.SupportEmail = this.state.supportEmail;

        return config;
    }

    getStateFromConfig(config) {
        return {
            termsOfServiceLink: config.SupportSettings.TermsOfServiceLink,
            privacyPolicyLink: config.SupportSettings.PrivacyPolicyLink,
            aboutLink: config.SupportSettings.AboutLink,
            helpLink: config.SupportSettings.HelpLink,
            reportAProblemLink: config.SupportSettings.ReportAProblemLink,
            supportEmail: config.SupportSettings.SupportEmail
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.customization.support'
                    defaultMessage='Legal and Support'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='termsOfServiceLink'
                    label={
                        <FormattedMessage
                            id='admin.support.termsTitle'
                            defaultMessage='Terms of Service link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.termsDesc'
                            defaultMessage='Link to the terms under which users may use your online service. By default, this includes the "Mattermost Conditions of Use (End Users)" explaining the terms under which Mattermost software is provided to end users. If you change the default link to add your own terms for using the service you provide, your new terms must include a link to the default terms so end users are aware of the Mattermost Conditions of Use (End User) for Mattermost software.'
                        />
                    }
                    value={this.state.termsOfServiceLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='privacyPolicyLink'
                    label={
                        <FormattedMessage
                            id='admin.support.privacyTitle'
                            defaultMessage='Privacy Policy link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.privacyDesc'
                            defaultMessage='Link to Privacy Policy available to users on desktop and on mobile. Leaving this blank will hide the option to display a notice.'
                        />
                    }
                    value={this.state.privacyPolicyLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='aboutLink'
                    label={
                        <FormattedMessage
                            id='admin.support.aboutTitle'
                            defaultMessage='About link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.aboutDesc'
                            defaultMessage='Link to About page for more information on your Mattermost deployment, for example its purpose and audience within your organization. Defaults to Mattermost information page.'
                        />
                    }
                    value={this.state.aboutLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='helpLink'
                    label={
                        <FormattedMessage
                            id='admin.support.helpTitle'
                            defaultMessage='Help link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.helpDesc'
                            defaultMessage='Link to help documentation from team site main menu. Typically not changed unless your organization chooses to create custom documentation.'
                        />
                    }
                    value={this.state.helpLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='reportAProblemLink'
                    label={
                        <FormattedMessage
                            id='admin.support.problemTitle'
                            defaultMessage='Report a Problem link:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.problemDesc'
                            defaultMessage='Link to help documentation from team site main menu. By default this points to the peer-to-peer troubleshooting forum where users can search for, find and request help with technical issues.'
                        />
                    }
                    value={this.state.reportAProblemLink}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='supportEmail'
                    label={
                        <FormattedMessage
                            id='admin.support.emailTitle'
                            defaultMessage='Support Email:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.emailHelp'
                            defaultMessage='Email address displayed on email notifications and during tutorial for end users to ask support questions.'
                        />
                    }
                    value={this.state.supportEmail}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
