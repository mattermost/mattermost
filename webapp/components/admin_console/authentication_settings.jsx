// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {GitLabSettings} from './gitlab_settings.jsx';
import {LdapSettings} from './ldap_settings.jsx';
import {OnboardingSettings} from './onboarding_settings.jsx';

export default class AuthenticationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableSignUpWithEmail: props.config.EmailSettings.EnableSignUpWithEmail,
            enableSignUpWithGitlab: props.config.GitLabSettings.Enable,
            enableSignUpWithLdap: props.config.LdapSettings.Enable,
            enableSignInWithEmail: props.config.EmailSettings.EnableSignInWithEmail,
            enableSignInWithUsername: props.config.EmailSettings.EnableSignInWithUsername,

            gitlabId: props.config.GitLabSettings.Id,
            gitlabSecret: props.config.GitLabSettings.Secret,
            gitlabUserApiEndpoint: props.config.GitLabSettings.UserApiEndpoint,
            gitlabAuthEndpoint: props.config.GitLabSettings.AuthEndpoint,
            gitlabTokenEndpoint: props.config.GitLabSettings.TokenEndpoint,

            ldapServer: props.config.LdapSettings.LdapServer,
            ldapPort: props.config.LdapSettings.LdapPort,
            ldapConnectionSecurity: props.config.LdapSettings.ConnectionSecurity,
            ldapBaseDN: props.config.LdapSettings.BaseDN,
            ldapBindUsername: props.config.LdapSettings.BindUsername,
            ldapBindPassword: props.config.LdapSettings.BindPassword,
            ldapUserFilter: props.config.LdapSettings.UserFilter,
            ldapFirstNameAttribute: props.config.LdapSettings.FirstNameAttribute,
            ldapLastNameAttribute: props.config.LdapSettings.LastNameAttribute,
            ldapNicknameAttribute: props.config.LdapSettings.NicknameAttribute,
            ldapEmailAttribute: props.config.LdapSettings.EmailAttribute,
            ldapUsernameAttribute: props.config.LdapSettings.UsernameAttribute,
            ldapIdAttribute: props.config.LdapSettings.IdAttribute,
            ldapSkipCertificateVerification: props.config.LdapSettings.SkipCertificateVerification,
            ldapQueryTimeout: props.config.LdapSettings.QueryTimeout,
            ldapLoginFieldName: props.config.LdapSettings.LoginFieldName,
            ldapPasswordFieldName: props.config.LdapSettings.PasswordFieldName
        });
    }

    getConfigFromState(config) {
        config.EmailSettings.EnableSignUpWithEmail = this.state.enableSignUpWithEmail;
        config.GitLabSettings.Enable = this.state.enableSignUpWithGitlab;
        config.LdapSettings.Enable = this.state.enableSignUpWithLdap;
        config.EmailSettings.EnableSignInWithEmail = this.state.enableSignInWithEmail;
        config.EmailSettings.EnableSignInWithUsername = this.state.enableSignInWithUsername;

        config.GitLabSettings.Id = this.state.gitlabId;
        config.GitLabSettings.Secret = this.state.gitlabSecret;
        config.GitLabSettings.UserApiEndpoint = this.state.gitlabUserApiEndpoint;
        config.GitLabSettings.AuthEndpoint = this.state.gitlabAuthEndpoint;
        config.GitLabSettings.TokenEndpoint = this.state.gitlabTokenEndpoint;

        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true') {
            config.LdapSettings.LdapServer = this.state.ldapServer;
            config.LdapSettings.LdapPort = this.state.ldapPort;
            config.LdapSettings.ConnectionSecurity = this.state.ldapConnectionSecurity;
            config.LdapSettings.BaseDN = this.state.ldapBaseDN;
            config.LdapSettings.BindUsername = this.state.ldapBindUsername;
            config.LdapSettings.BindPassword = this.state.ldapBindPassword;
            config.LdapSettings.UserFilter = this.state.ldapUserFilter;
            config.LdapSettings.FirstNameAttribute = this.state.ldapFirstNameAttribute;
            config.LdapSettings.LastNameAttribute = this.state.ldapLastNameAttribute;
            config.LdapSettings.NicknameAttribute = this.state.ldapNicknameAttribute;
            config.LdapSettings.EmailAttribute = this.state.ldapEmailAttribute;
            config.LdapSettings.UsernameAttribute = this.state.ldapUsernameAttribute;
            config.LdapSettings.IdAttribute = this.state.ldapIdAttribute;
            config.LdapSettings.SkipCertificateVerification = this.state.ldapSkipCertificateVerification;
            config.LdapSettings.QueryTimeout = this.state.ldapQueryTimeout;
            config.LdapSettings.LoginFieldName = this.state.ldapLoginFieldName;
            config.LdapSettings.PasswordFieldName = this.state.ldapPasswordFieldName;
        }

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
        const ldapEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true';

        let ldapSettings = null;
        if (ldapEnabled) {
            ldapSettings = (
                <LdapSettings
                    enableSignUpWithLdap={this.state.enableSignUpWithLdap}
                    ldapServer={this.state.ldapServer}
                    ldapPort={this.state.ldapPort}
                    ldapConnectionSecurity={this.state.ldapConnectionSecurity}
                    ldapBaseDN={this.state.ldapBaseDN}
                    ldapBindUsername={this.state.ldapBindUsername}
                    ldapBindPassword={this.state.ldapBindPassword}
                    ldapUserFilter={this.state.ldapUserFilter}
                    ldapFirstNameAttribute={this.state.ldapFirstNameAttribute}
                    ldapLastNameAttribute={this.state.ldapLastNameAttribute}
                    ldapNicknameAttribute={this.state.ldapNicknameAttribute}
                    ldapEmailAttribute={this.state.ldapEmailAttribute}
                    ldapUsernameAttribute={this.state.ldapUsernameAttribute}
                    ldapIdAttribute={this.state.ldapIdAttribute}
                    ldapSkipCertificateVerification={this.state.ldapSkipCertificateVerification}
                    ldapQueryTimeout={this.state.ldapQueryTimeout}
                    ldapLoginFieldName={this.state.ldapLoginFieldName}
                    ldapPasswordFieldName={this.state.ldapPasswordFieldName}
                    onChange={this.handleChange}
                />
            );
        }

        return (
            <div>
                <OnboardingSettings
                    enableSignUpWithEmail={this.state.enableSignUpWithEmail}
                    enableSignUpWithGitlab={this.state.enableSignUpWithGitlab}
                    enableSignUpWithLdap={this.state.enableSignUpWithLdap}
                    enableSignInWithEmail={this.state.enableSignInWithEmail}
                    enableSignInWithUsername={this.state.enableSignInWithUsername}
                    onChange={this.handleChange}
                />
                <GitLabSettings
                    enableSignUpWithGitlab={this.state.enableSignUpWithGitlab}
                    gitlabId={this.state.gitlabId}
                    gitlabSecret={this.state.gitlabSecret}
                    gitlabUserApiEndpoint={this.state.gitlabUserApiEndpoint}
                    gitlabAuthEndpoint={this.state.gitlabAuthEndpoint}
                    gitlabTokenEndpoint={this.state.gitlabTokenEndpoint}
                    onChange={this.handleChange}
                />
                {ldapSettings}
            </div>
        );
    }
}
