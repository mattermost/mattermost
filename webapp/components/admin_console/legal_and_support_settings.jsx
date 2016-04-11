// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class LegalAndSupportSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            termsOfServiceLink: props.config.SupportSettings.TermsOfServiceLink,
            privacyPolicyLink: props.config.SupportSettings.PrivacyPolicyLink,
            aboutLink: props.config.SupportSettings.AboutLink,
            helpLink: props.config.SupportSettings.HelpLink,
            reportAProblemLink: props.config.SupportSettings.ReportAProblemLink,
            supportEmail: props.config.SupportSettings.SupportEmail
        });
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
            <LegalAndSupportSettings
                termsOfServiceLink={this.state.termsOfServiceLink}
                privacyPolicyLink={this.state.privacyPolicyLink}
                aboutLink={this.state.aboutLink}
                helpLink={this.state.helpLink}
                reportAProblemLink={this.state.reportAProblemLink}
                supportEmail={this.state.supportEmail}
                onChange={this.handleChange}
            />
        );
    }
}

export class LegalAndSupportSettings extends React.Component {
    static get propTypes() {
        return {
            termsOfServiceLink: React.PropTypes.string.isRequired,
            privacyPolicyLink: React.PropTypes.string.isRequired,
            aboutLink: React.PropTypes.string.isRequired,
            helpLink: React.PropTypes.string.isRequired,
            reportAProblemLink: React.PropTypes.string.isRequired,
            supportEmail: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.customization.support'
                        defaultMessage='Legal and Support'
                    />
                }
            >
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
                            defaultMessage='Link to Terms of Service available to users on desktop and on mobile. Leaving this blank will hide the option to display a notice.'
                        />
                    }
                    value={this.props.termsOfServiceLink}
                    onChange={this.props.onChange}
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
                    value={this.props.privacyPolicyLink}
                    onChange={this.props.onChange}
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
                    value={this.props.aboutLink}
                    onChange={this.props.onChange}
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
                    value={this.props.helpLink}
                    onChange={this.props.onChange}
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
                    value={this.props.reportAProblemLink}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='supportEmail'
                    label={
                        <FormattedMessage
                            id='admin.support.emailTitle'
                            defaultMessage='Support email:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.support.emailHelp'
                            defaultMessage='Email shown during tutorial for end users to ask support questions.'
                        />
                    }
                    value={this.props.supportEmail}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
