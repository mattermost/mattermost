// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class GitLabSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            gitlabId: props.config.GitLabSettings.Id,
            gitlabSecret: props.config.GitLabSettings.Secret,
            gitlabUserApiEndpoint: props.config.GitLabSettings.UserApiEndpoint,
            gitlabAuthEndpoint: props.config.GitLabSettings.AuthEndpoint,
            gitlabTokenEndpoint: props.config.GitLabSettings.TokenEndpoint
        });
    }

    getConfigFromState(config) {
        config.GitLabSettings.Id = this.state.gitlabId;
        config.GitLabSettings.Secret = this.state.gitlabSecret;
        config.GitLabSettings.UserApiEndpoint = this.state.gitlabUserApiEndpoint;
        config.GitLabSettings.AuthEndpoint = this.state.gitlabAuthEndpoint;
        config.GitLabSettings.TokenEndpoint = this.state.gitlabTokenEndpoint;

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
            <GitLabSettings
                enableSignUpWithGitlab={this.props.config.GitLabSettings.Enable}
                gitlabId={this.state.gitlabId}
                gitlabSecret={this.state.gitlabSecret}
                gitlabUserApiEndpoint={this.state.gitlabUserApiEndpoint}
                gitlabAuthEndpoint={this.state.gitlabAuthEndpoint}
                gitlabTokenEndpoint={this.state.gitlabTokenEndpoint}
                onChange={this.handleChange}
            />
        );
    }
}

export class GitLabSettings extends React.Component {
    static get propTypes() {
        return {
            enableSignUpWithGitlab: React.PropTypes.bool.isRequired,
            gitlabId: React.PropTypes.string.isRequired,
            gitlabSecret: React.PropTypes.string.isRequired,
            gitlabUserApiEndpoint: React.PropTypes.string.isRequired,
            gitlabAuthEndpoint: React.PropTypes.string.isRequired,
            gitlabTokenEndpoint: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        let disabledMessage = null;
        if (!this.props.enableSignUpWithGitlab) {
            disabledMessage = (
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.authentication.gitlab.disabled'
                            defaultMessage='GitLab settings cannot be changed while GitLab Sign Up is disabled.'
                        />
                    </div>
                </div>
            );
        }

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.authentication.gitlab'
                        defaultMessage='GitLab'
                    />
<<<<<<< HEAD
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            <FormattedMessage
                                id='admin.gitlab.enableTitle'
                                defaultMessage='Enable Sign Up With GitLab: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='true'
                                    ref='Enable'
                                    defaultChecked={this.props.config.GitLabSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableTrue')}
                                />
                                <FormattedMessage
                                    id='admin.gitlab.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.GitLabSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableFalse')}
                                />
                                <FormattedMessage
                                    id='admin.gitlab.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitlab.enableDescription'
                                    defaultMessage='When true, Mattermost allows team creation and account signup using GitLab OAuth.'
                                />
                                <br/>
                            </p>
                            <div className='help-text'>
                                <FormattedHTMLMessage
                                    id='admin.gitlab.EnableHtmlDesc'
                                    defaultMessage='<ol><li>Log in to your GitLab account and go to Profile Settings -> Applications.</li><li>Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". </li><li>Then use "Secret" and "Id" fields from GitLab to complete the options below.</li><li>Complete the Endpoint URLs below. </li></ol>'
                                />
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Id'
                        >
                            <FormattedMessage
                                id='admin.gitlab.clientIdTitle'
                                defaultMessage='Id:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Id'
                                ref='Id'
                                placeholder={formatMessage(holders.clientIdExample)}
                                defaultValue={this.props.config.GitLabSettings.Id}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitlab.clientIdDescription'
                                    defaultMessage='Obtain this value via the instructions above for logging into GitLab'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Secret'
                        >
                            <FormattedMessage
                                id='admin.gitlab.clientSecretTitle'
                                defaultMessage='Secret:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Secret'
                                ref='Secret'
                                placeholder={formatMessage(holders.clientSecretExample)}
                                defaultValue={this.props.config.GitLabSettings.Secret}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitab.clientSecretDescription'
                                    defaultMessage='Obtain this value via the instructions above for logging into GitLab.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AuthEndpoint'
                        >
                            <FormattedMessage
                                id='admin.gitlab.authTitle'
                                defaultMessage='Auth Endpoint:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AuthEndpoint'
                                ref='AuthEndpoint'
                                placeholder={formatMessage(holders.authExample)}
                                defaultValue={this.props.config.GitLabSettings.AuthEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitlab.authDescription'
                                    defaultMessage='Enter https://<your-gitlab-url>/oauth/authorize (example https://example.com:3000/oauth/authorize).   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='TokenEndpoint'
                        >
                            <FormattedMessage
                                id='admin.gitlab.tokenTitle'
                                defaultMessage='Token Endpoint:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='TokenEndpoint'
                                ref='TokenEndpoint'
                                placeholder={formatMessage(holders.tokenExample)}
                                defaultValue={this.props.config.GitLabSettings.TokenEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitlab.tokenDescription'
                                    defaultMessage='Enter https://<your-gitlab-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='UserApiEndpoint'
                        >
                            <FormattedMessage
                                id='admin.gitlab.userTitle'
                                defaultMessage='User API Endpoint:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='UserApiEndpoint'
                                ref='UserApiEndpoint'
                                placeholder={formatMessage(holders.userExample)}
                                defaultValue={this.props.config.GitLabSettings.UserApiEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.gitlab.userDescription'
                                    defaultMessage='Enter https://<your-gitlab-url>/api/v3/user.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.gitlab.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>

                </form>
            </div>
=======
                }
            >
                {disabledMessage}
                <TextSetting
                    id='gitlabId'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.clientIdTitle'
                            defaultMessage='Id:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.clientIdExample', 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.clientIdDescription'
                            defaultMessage='Obtain this value via the instructions above for logging into GitLab'
                        />
                    }
                    value={this.props.gitlabId}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithGitlab}
                />
                <TextSetting
                    id='gitlabSecret'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.clientSecretTitle'
                            defaultMessage='Secret:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.clientSecretExample', 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitab.clientSecretDescription'
                            defaultMessage='Obtain this value via the instructions above for logging into GitLab.'
                        />
                    }
                    value={this.props.gitlabSecret}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithGitlab}
                />
                <TextSetting
                    id='gitlabUserApiEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.userTitle'
                            defaultMessage='User API Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.userExample', 'Ex ""')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.userDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/api/v3/user.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.props.gitlabUserApiEndpoint}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithGitlab}
                />
                <TextSetting
                    id='gitlabAuthEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.authTitle'
                            defaultMessage='Auth Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.authExample', 'Ex ""')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.authDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/oauth/authorize (example https://example.com:3000/oauth/authorize).   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.props.gitlabAuthEndpoint}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithGitlab}
                />
                <TextSetting
                    id='gitlabTokenEndpoint'
                    label={
                        <FormattedMessage
                            id='admin.gitlab.tokenTitle'
                            defaultMessage='Token Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.gitlab.tokenExample', 'Ex ""')}
                    helpText={
                        <FormattedMessage
                            id='admin.gitlab.tokenDescription'
                            defaultMessage='Enter https://<your-gitlab-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URL depending on your server configuration.'
                        />
                    }
                    value={this.props.gitlabTokenEndpoint}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithGitlab}
                />
            </SettingsGroup>
>>>>>>> 6d02983... Reorganized system console
        );
    }
}
