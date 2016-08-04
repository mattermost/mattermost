// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import AdminSettings from './admin_settings.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

import React from 'react';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';

export default class OAuthSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.getStateFromConfig = this.getStateFromConfig.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
        this.renderOffice365 = this.renderOffice365.bind(this);
        this.renderGoogle = this.renderGoogle.bind(this);
        this.renderGitLab = this.renderGitLab.bind(this);
        this.changeType = this.changeType.bind(this);
    }

    getConfigFromState(config) {
        config.GitLabSettings.Enable = false;
        config.GoogleSettings.Enable = false;
        config.Office365Settings.Enable = false;

        if (this.state.oauthType === Constants.GITLAB_SERVICE) {
            config.GitLabSettings.Enable = true;
            config.GitLabSettings.Id = this.state.id;
            config.GitLabSettings.Secret = this.state.secret;
            config.GitLabSettings.UserApiEndpoint = this.state.userApiEndpoint;
            config.GitLabSettings.AuthEndpoint = this.state.authEndpoint;
            config.GitLabSettings.TokenEndpoint = this.state.tokenEndpoint;
        }

        if (this.state.oauthType === Constants.GOOGLE_SERVICE) {
            config.GoogleSettings.Enable = true;
            config.GoogleSettings.Id = this.state.id;
            config.GoogleSettings.Secret = this.state.secret;
            config.GoogleSettings.UserApiEndpoint = 'https://www.googleapis.com/plus/v1/people/me';
            config.GoogleSettings.AuthEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
            config.GoogleSettings.TokenEndpoint = 'https://www.googleapis.com/oauth2/v4/token';
            config.GoogleSettings.Scope = 'profile email';
        }

        if (this.state.oauthType === Constants.OFFICE365_SERVICE) {
            config.Office365Settings.Enable = true;
            config.Office365Settings.Id = this.state.id;
            config.Office365Settings.Secret = this.state.secret;
            config.Office365Settings.UserApiEndpoint = 'https://graph.microsoft.com/v1.0/me';
            config.Office365Settings.AuthEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
            config.Office365Settings.TokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
            config.Office365Settings.Scope = 'User.Read';
        }

        return config;
    }

    getStateFromConfig(config) {
        this.config = config;

        let oauthType = 'off';
        let settings = {};
        if (config.GitLabSettings.Enable) {
            oauthType = Constants.GITLAB_SERVICE;
            settings = config.GitLabSettings;
        } else if (config.GoogleSettings.Enable) {
            oauthType = Constants.GOOGLE_SERVICE;
            settings = config.GoogleSettings;
        } else if (config.Office365Settings.Enable) {
            oauthType = Constants.OFFICE365_SERVICE;
            settings = config.Office365Settings;
        }

        return {
            oauthType,
            id: settings.Id,
            secret: settings.Secret,
            userApiEndpoint: settings.UserApiEndpoint,
            authEndpoint: settings.AuthEndpoint,
            tokenEndpoint: settings.TokenEndpoint
        };
    }

    changeType(id, value) {
        let settings = {};
        if (value === Constants.GITLAB_SERVICE) {
            settings = this.config.GitLabSettings;
        } else if (value === Constants.GOOGLE_SERVICE) {
            settings = this.config.GoogleSettings;
        } else if (value === Constants.OFFICE365_SERVICE) {
            settings = this.config.Office365Settings;
        }

        this.setState({
            id: settings.Id,
            secret: settings.Secret,
            userApiEndpoint: settings.UserApiEndpoint,
            authEndpoint: settings.AuthEndpoint,
            tokenEndpoint: settings.TokenEndpoint
        });

        this.handleChange(id, value);
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.authentication.oauth'
                    defaultMessage='OAuth 2.0'
                />
            </h3>
        );
    }

    renderGoogle() {
        return (
            <div>
                <TextSetting
                    id='id'
                    label={
                        <FormattedMessage
                            id='admin.google.clientIdTitle'
                            defaultMessage='Client ID:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.google.clientIdExample', 'Ex "7602141235235-url0fhs1mayfasbmop5qlfns8dh4.apps.googleusercontent.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.google.clientIdDescription'
                            defaultMessage='The Client ID you received when registering your application with Google.'
                        />
                    }
                    value={this.state.id}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='secret'
                    label={
                        <FormattedMessage
                            id='admin.google.clientSecretTitle'
                            defaultMessage='Client Secret:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.google.clientSecretExample', 'Ex "H8sz0Az-dDs2p15-7QzD231"')}
                    helpText={
                        <FormattedMessage
                            id='admin.google.clientSecretDescription'
                            defaultMessage='The Client Secret you received when registering your application with Google.'
                        />
                    }
                    value={this.state.secret}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='userApiEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.google.userTitle'
                            defaultMessage='User API Endpoint:'
                        />
                    }
                    value='https://www.googleapis.com/plus/v1/people/me'
                    disabled={true}
                />
                <TextSetting
                    id='authEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.google.authTitle'
                            defaultMessage='Auth Endpoint:'
                        />
                    }
                    value='https://accounts.google.com/o/oauth2/v2/auth'
                    disabled={true}
                />
                <TextSetting
                    id='tokenEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.google.tokenTitle'
                            defaultMessage='Token Endpoint:'
                        />
                    }
                    value='https://www.googleapis.com/oauth2/v4/token'
                    disabled={true}
                />
            </div>
        );
    }

    renderOffice365() {
        return (
            <div>
                <TextSetting
                    id='id'
                    label={
                        <FormattedMessage
                            id='admin.office365.clientIdTitle'
                            defaultMessage='Application ID:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.office365.clientIdExample', 'Ex "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"')}
                    helpText={
                        <FormattedMessage
                            id='admin.office365.clientIdDescription'
                            defaultMessage='The Application/Client ID you received when registering your application with Microsoft.'
                        />
                    }
                    value={this.state.id}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='secret'
                    label={
                        <FormattedMessage
                            id='admin.office365.clientSecretTitle'
                            defaultMessage='Application Secret Password:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.office365.clientSecretExample', 'Ex "shAieM47sNBfgl20f8ci294"')}
                    helpText={
                        <FormattedMessage
                            id='admin.office365.clientSecretDescription'
                            defaultMessage='The Application Secret Password you generated when registering your application with Microsoft.'
                        />
                    }
                    value={this.state.secret}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='userApiEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.office365.userTitle'
                            defaultMessage='User API Endpoint:'
                        />
                    }
                    value='https://graph.microsoft.com/v1.0/me'
                    disabled={true}
                />
                <TextSetting
                    id='authEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.office365.authTitle'
                            defaultMessage='Auth Endpoint:'
                        />
                    }
                    value='https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
                    disabled={true}
                />
                <TextSetting
                    id='tokenEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.office365.tokenTitle'
                            defaultMessage='Token Endpoint:'
                        />
                    }
                    value='https://login.microsoftonline.com/common/oauth2/v2.0/token'
                    disabled={true}
                />
            </div>
        );
    }

    renderGitLab() {
        return (
            <div>
                <TextSetting
                    id='id'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.clientIdTitle'
                            defaultMessage='Application ID:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.clientIdExample', 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.clientIdDescription'
                            defaultMessage='Obtain this value via the instructions above for logging into GitLab'
                        />
                    }
                    value={this.state.id}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='secret'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.clientSecretTitle'
                            defaultMessage='Application Secret Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.clientSecretExample', 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitab.clientSecretDescription'
                            defaultMessage='Obtain this value via the instructions above for logging into GitLab.'
                        />
                    }
                    value={this.state.secret}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='userApiEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.userTitle'
                            defaultMessage='User API Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.userExample', 'Ex "https://<your-gitlab-url>/api/v3/user"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.userDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/api/v3/user.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.state.userApiEndpoint}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='authEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.authTitle'
                            defaultMessage='Auth Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.authExample', 'Ex "https://<your-gitlab-url>/oauth/authorize"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.authDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/oauth/authorize (example https://example.com:3000/oauth/authorize).   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.state.authEndpoint}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='tokenEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.tokenTitle'
                            defaultMessage='Token Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.tokenExample', 'Ex "https://<your-gitlab-url>/oauth/token"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.tokenDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.state.tokenEndpoint}
                    onChange={this.handleChange}
                />
            </div>
        );
    }

    renderSettings() {
        let contents;
        let helpText;
        if (this.state.oauthType === Constants.GITLAB_SERVICE) {
            contents = this.renderGitLab();
            helpText = (
                <FormattedHTMLMessage
                    id='admin.gitlab.EnableHtmlDesc'
                    defaultMessage='<ol><li>Log in to your GitLab account and go to Profile Settings -> Applications.</li><li>Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". </li><li>Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.</li><li>Complete the Endpoint URLs below. </li></ol>'
                />
            );
        } else if (this.state.oauthType === Constants.GOOGLE_SERVICE) {
            contents = this.renderGoogle();
            helpText = (
                <FormattedHTMLMessage
                    id='admin.google.EnableHtmlDesc'
                    defaultMessage='<ol><li><a href="https://accounts.google.com/login">Log in</a> to your Google account.</li><li>Go to <a href="https://console.developers.google.com">https://console.developers.google.com</a>, click <strong>Credentials</strong> in the left hand sidebar and enter "Mattermost - your-company-name" as the <strong>Project Name</strong>, then click <strong>Create</strong>.</li><li>Click the <strong>OAuth consent screen</strong> header and enter "Mattermost" as the <strong>Product name shown to users</strong>, then click <strong>Save</strong>.</li><li>Under the <strong>Credentials</strong> header, click <strong>Create credentials</strong>, choose <strong>OAuth client ID</strong> and select <strong>Web Application</strong>.</li><li>Under <strong>Restrictions</strong> and <strong>Authorized redirect URIs</strong> enter <strong>your-mattermost-url/signup/google/complete</strong> (example: http://localhost:8065/signup/google/complete). Click <strong>Create</strong>.</li><li>Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> to the fields below, then click <strong>Save</strong>.</li><li>Finally, go to <a href="https://console.developers.google.com/apis/api/plus/overview">Google+ API</a> and click <strong>Enable</strong>. This might take a few minutes to propagate through Google`s systems.</li></ol>'
                />
            );
        } else if (this.state.oauthType === Constants.OFFICE365_SERVICE) {
            contents = this.renderOffice365();
            helpText = (
                <FormattedHTMLMessage
                    id='admin.office365.EnableHtmlDesc'
                    defaultMessage='<ol><li><a href="https://login.microsoftonline.com/">Log in</a> to your Microsoft or Office 365 account. Make sure its the account on the same <a href="https://msdn.microsoft.com/en-us/library/azure/jj573650.aspx#Anchor_0">tenant</a> that you would like users to log in with.</li><li>Go to <a href="https://apps.dev.microsoft.com">https://apps.dev.microsoft.com</a>, click <strong>Go to app list</strong> > <strong>Add an app</strong> and use "Mattermost - your-company-name" as the <strong>Application Name</strong>.</li><li>Under <strong>Application Secrets</strong>, click <strong>Generate New Password</strong> and paste it to the <strong>Application Secret Password</strong> field below.</li><li>Under <strong>Platforms</strong>, click <strong>Add Platform</strong>, choose <strong>Web</strong> and enter <strong>your-mattermost-url/signup/office365/complete</strong> (example: http://localhost:8065/signup/office365/complete) under <strong>Redirect URIs</strong>. Also uncheck <strong>Allow Implicit Flow</strong>.</li><li>Finally, click <strong>Save</strong> and then paste the <strong>Application ID</strong> below.</li></ol>'
                />
            );
        }

        const oauthTypes = [];
        oauthTypes.push({value: 'off', text: Utils.localizeMessage('admin.oauth.off', 'Do not allow sign-in via an OAuth 2.0 provider.')});
        oauthTypes.push({value: Constants.GITLAB_SERVICE, text: Utils.localizeMessage('admin.oauth.gitlab', 'GitLab')});
        if (global.window.mm_license.IsLicensed === 'true') {
            if (global.window.mm_license.GoogleSSO === 'true') {
                oauthTypes.push({value: Constants.GOOGLE_SERVICE, text: Utils.localizeMessage('admin.oauth.google', 'Google Apps')});
            }
            if (global.window.mm_license.Office365SSO === 'true') {
                oauthTypes.push({value: Constants.OFFICE365_SERVICE, text: Utils.localizeMessage('admin.oauth.office365', 'Office 365')});
            }
        }

        return (
            <SettingsGroup>
                <DropdownSetting
                    id='oauthType'
                    values={oauthTypes}
                    label={
                        <FormattedMessage
                            id='admin.oauth.select'
                            defaultMessage='Select OAuth 2.0 Service Provider:'
                        />
                    }
                    helpText={helpText}
                    value={this.state.oauthType}
                    onChange={this.changeType}
                />
                {contents}
            </SettingsGroup>
        );
    }
}
