// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class GitLabSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.GitLabSettings.Enable = this.state.enable;
        config.GitLabSettings.Id = this.state.id;
        config.GitLabSettings.Secret = this.state.secret;
        config.GitLabSettings.UserApiEndpoint = this.state.userApiEndpoint;
        config.GitLabSettings.AuthEndpoint = this.state.authEndpoint;
        config.GitLabSettings.TokenEndpoint = this.state.tokenEndpoint;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enable: config.GitLabSettings.Enable,
            id: config.GitLabSettings.Id,
            secret: config.GitLabSettings.Secret,
            userApiEndpoint: config.GitLabSettings.UserApiEndpoint,
            authEndpoint: config.GitLabSettings.AuthEndpoint,
            tokenEndpoint: config.GitLabSettings.TokenEndpoint
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.authentication.gitlab'
                defaultMessage='GitLab'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.enableTitle'
                            defaultMessage='Enable authentication with GitLab: '
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
                                defaultMessage='<ol><li>Log in to your GitLab account and go to Profile Settings -> Applications.</li><li>Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". </li><li>Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.</li><li>Complete the Endpoint URLs below. </li></ol>'
                            />
                        </div>
                    }
                    value={this.state.enable}
                    onChange={this.handleChange}
                />
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
                    disabled={!this.state.enable}
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
                    disabled={!this.state.enable}
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
                    disabled={!this.state.enable}
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
                    disabled={!this.state.enable}
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
                    disabled={!this.state.enable}
                />
            </SettingsGroup>
        );
    }
}
