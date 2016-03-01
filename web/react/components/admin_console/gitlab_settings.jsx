// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const holders = defineMessages({
    clientIdExample: {
        id: 'admin.gitlab.clientIdExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    clientSecretExample: {
        id: 'admin.gitlab.clientSecretExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    authExample: {
        id: 'admin.gitlab.authExample',
        defaultMessage: 'Ex ""'
    },
    tokenExample: {
        id: 'admin.gitlab.tokenExample',
        defaultMessage: 'Ex ""'
    },
    userExample: {
        id: 'admin.gitlab.userExample',
        defaultMessage: 'Ex ""'
    },
    saving: {
        id: 'admin.gitlab.saving',
        defaultMessage: 'Saving Config...'
    }
});

class GitLabSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            Enable: this.props.config.GitLabSettings.Enable,
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'EnableTrue') {
            s.Enable = true;
        }

        if (action === 'EnableFalse') {
            s.Enable = false;
        }

        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.GitLabSettings.Enable = ReactDOM.findDOMNode(this.refs.Enable).checked;
        config.GitLabSettings.Secret = ReactDOM.findDOMNode(this.refs.Secret).value.trim();
        config.GitLabSettings.Id = ReactDOM.findDOMNode(this.refs.Id).value.trim();
        config.GitLabSettings.AuthEndpoint = ReactDOM.findDOMNode(this.refs.AuthEndpoint).value.trim();
        config.GitLabSettings.TokenEndpoint = ReactDOM.findDOMNode(this.refs.TokenEndpoint).value.trim();
        config.GitLabSettings.UserApiEndpoint = ReactDOM.findDOMNode(this.refs.UserApiEndpoint).value.trim();

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        return (
            <div className='wrapper--fixed'>

                <h3>
                    <FormattedMessage
                        id='admin.gitlab.settingsTitle'
                        defaultMessage='GitLab Settings'
                    />
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
        );
    }
}

//config.GitLabSettings.Scope = ReactDOM.findDOMNode(this.refs.Scope).value.trim();
//  <div className='form-group'>
//     <label
//         className='control-label col-sm-4'
//         htmlFor='Scope'
//     >
//         {'Scope:'}
//     </label>
//     <div className='col-sm-8'>
//         <input
//             type='text'
//             className='form-control'
//             id='Scope'
//             ref='Scope'
//             placeholder='Not currently used by GitLab. Please leave blank'
//             defaultValue={this.props.config.GitLabSettings.Scope}
//             onChange={this.handleChange}
//             disabled={!this.state.Allow}
//         />
//         <p className='help-text'>{'This field is not yet used by GitLab OAuth. Other OAuth providers may use this field to specify the scope of account data from OAuth provider that is sent to Mattermost.'}</p>
//     </div>
// </div>

GitLabSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(GitLabSettings);
