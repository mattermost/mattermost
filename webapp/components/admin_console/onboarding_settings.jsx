// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';

export class OnboardingSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableSignUpWithEmail: props.config.EmailSettings.EnableSignUpWithEmail,
            enableSignUpWithGitlab: props.config.GitLabSettings.Enable,
            enableSignUpWithLdap: props.config.LdapSettings.Enable,
            enableSignInWithEmail: props.config.EmailSettings.EnableSignInWithEmail,
            enableSignInWithUsername: props.config.EmailSettings.EnableSignInWithUsername
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.EnableSignUpWithEmail = this.state.enableSignUpWithEmail;
        config.GitLabSettings.Enable = this.state.enableSignUpWithGitlab;
        config.LdapSettings.Enable = this.state.enableSignUpWithLdap;
        config.EmailSettings.EnableSignInWithEmail = this.state.enableSignInWithEmail;
        config.EmailSettings.EnableSignInWithUsername = this.state.enableSignInWithUsername;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.authentication.title'
                    defaultMessage='Authentication Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <OnboardingSettings
                enableSignUpWithEmail={this.state.enableSignUpWithEmail}
                enableSignUpWithGitlab={this.state.enableSignUpWithGitlab}
                enableSignUpWithLdap={this.state.enableSignUpWithLdap}
                enableSignInWithEmail={this.state.enableSignInWithEmail}
                enableSignInWithUsername={this.state.enableSignInWithUsername}
                onChange={this.handleChange}
            />
        );
    }
}

export class OnboardingSettings extends React.Component {
    static get propTypes() {
        return {
            enableSignUpWithEmail: React.PropTypes.bool.isRequired,
            enableSignUpWithGitlab: React.PropTypes.bool.isRequired,
            enableSignUpWithLdap: React.PropTypes.bool.isRequired,
            enableSignInWithEmail: React.PropTypes.bool.isRequired,
            enableSignInWithUsername: React.PropTypes.bool.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        let enableSignUpWithLdap = null;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true') {
            enableSignUpWithLdap = (
                <BooleanSetting
                    id='enableSignUpWithLdap'
                    label={
                        <FormattedMessage
                            id='admin.ldap.enableTitle'
                            defaultMessage='Enable Login With LDAP:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.enableDesc'
                            defaultMessage='When true, Mattermost allows login using LDAP'
                        />
                    }
                    value={this.props.enableSignUpWithLdap}
                    onChange={this.props.onChange}
                />
            );
        }

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.authentication.onboarding'
                        defaultMessage='Onboarding'
                    />
                }
            >
                <BooleanSetting
                    id='enableSignUpWithEmail'
                    label={
                        <FormattedMessage
                            id='admin.email.allowSignupTitle'
                            defaultMessage='Allow Sign Up With Email: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowSignupDescription'
                            defaultMessage='When true, Mattermost allows team creation and account signup using email and password.  This value should be false only when you want to limit signup to a single-sign-on service like OAuth or LDAP.'
                        />
                    }
                    value={this.props.enableSignUpWithEmail}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enableSignUpWithGitlab'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.enableTitle'
                            defaultMessage='Enable Sign Up With GitLab: '
                        />
                    }
                    helpText={
                        <div>
                            <FormattedMessage
                                id='admin.gitlab.enableDescription'
                                defaultMessage='When true, Mattermost allows team creation and account signup using GitLab OAuth.'
                            />
                            <br/>
                            <FormattedHTMLMessage
                                id='admin.gitlab.EnableHtmlDesc'
                                defaultMessage='<ol><li>Log in to your GitLab account and go to Profile Settings -> Applications.</li><li>Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". </li><li>Then use "Secret" and "Id" fields from GitLab to complete the options below.</li><li>Complete the Endpoint URLs below. </li></ol>'
                            />
                        </div>
                    }
                    value={this.props.enableSignUpWithGitlab}
                    onChange={this.props.onChange}
                />
                {enableSignUpWithLdap}
                <BooleanSetting
                    id='enableSignInWithEmail'
                    label={
                        <FormattedMessage
                            id='admin.email.allowEmailSignInTitle'
                            defaultMessage='Allow Sign In With Email: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowEmailSignInDescription'
                            defaultMessage='When true, Mattermost allows users to sign in using their email and password.'
                        />
                    }
                    value={this.props.enableSignInWithEmail}
                    onChange={this.props.onChange}
                />
                <BooleanSetting
                    id='enableSignInWithUsername'
                    label={
                        <FormattedMessage
                            id='admin.email.allowUsernameSignInTitle'
                            defaultMessage='Allow Sign In With Username: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.email.allowUsernameSignInDescription'
                            defaultMessage='When true, Mattermost allows users to sign in using their username and password.  This setting is typically only used when email verification is disabled.'
                        />
                    }
                    value={this.props.enableSignInWithUsername}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}