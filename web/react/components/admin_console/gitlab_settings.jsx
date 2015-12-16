// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const messages = defineMessages({
    settingsTitle: {
        id: 'admin.gitlab.settingsTitle',
        defaultMessage: 'GitLab Settings'
    },
    enableTitle: {
        id: 'admin.gitlab.enableTitle',
        defaultMessage: 'Enable Sign Up With GitLab: '
    },
    enableDescription: {
        id: 'admin.gitlab.enableDescription',
        defaultMessage: 'When true, Mattermost allows team creation and account signup using GitLab OAuth. To configure, log in to your GitLab account and go to Applications -> Profile Settings. Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". Then use "Secret" and "Id" fields to complete the options below.'
    },
    true: {
        id: 'admin.gitlab.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.gitlab.false',
        defaultMessage: 'false'
    },
    clientIdTitle: {
        id: 'admin.gitlab.clientIdTitle',
        defaultMessage: 'Id:'
    },
    clientIdExample: {
        id: 'admin.gitlab.clientIdExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    clientIdDescription: {
        id: 'admin.gitlab.clientIdDescription',
        defaultMessage: 'Obtain this value via the instructions above for logging into GitLab'
    },
    clientSecretTitle: {
        id: 'admin.gitlab.clientSecretTitle',
        defaultMessage: 'Secret:'
    },
    clientSecretExample: {
        id: 'admin.gitlab.clientSecretExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    clientSecretDescription: {
        id: 'admin.gitab.clientSecretDescription',
        defaultMessage: 'Obtain this value via the instructions above for logging into GitLab.'
    },
    authTitle: {
        id: 'admin.gitlab.authTitle',
        defaultMessage: 'Auth Endpoint:'
    },
    authExample: {
        id: 'admin.gitlab.authExample',
        defaultMessage: 'Ex ""'
    },
    authDescription: {
        id: 'admin.gitlab.authDescription',
        defaultMessage: 'Enter <your-gitlab-url>/oauth/authorize (example http://localhost:3000/oauth/authorize).  Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    tokenTitle: {
        id: 'admin.gitlab.tokenTitle',
        defaultMessage: 'Token Endpoint:'
    },
    tokenExample: {
        id: 'admin.gitlab.tokenExample',
        defaultMessage: 'Ex ""'
    },
    tokenDescription: {
        id: 'admin.gitlab.tokenDescription',
        defaultMessage: 'Enter <your-gitlab-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    userTitle: {
        id: 'admin.gitlab.userTitle',
        defaultMessage: 'User API Endpoint:'
    },
    userExample: {
        id: 'admin.gitlab.userExample',
        defaultMessage: 'Ex ""'
    },
    userDescription: {
        id: 'admin.gitlab.userDescription',
        defaultMessage: 'Enter <your-gitlab-url>/api/v3/user.  Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    saving: {
        id: 'admin.gitlab.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.gitlab.save',
        defaultMessage: 'Save'
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

                <h3>{formatMessage(messages.settingsTitle)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            {formatMessage(messages.enableTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.GitLabSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableFalse')}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>
                                {formatMessage(messages.enableDescription)} <br/>
                            </p>
                            <div className='help-text'>
                                <FormattedHTMLMessage id='admin.gitlab.EnableHtmlDesc' />
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Id'
                        >
                            {formatMessage(messages.clientIdTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Id'
                                ref='Id'
                                placeholder={formatMessage(messages.clientIdExample)}
                                defaultValue={this.props.config.GitLabSettings.Id}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{formatMessage(messages.clientIdDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Secret'
                        >
                            {formatMessage(messages.clientSecretTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Secret'
                                ref='Secret'
                                placeholder={formatMessage(messages.clientSecretExample)}
                                defaultValue={this.props.config.GitLabSettings.Secret}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{formatMessage(messages.clientSecretDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AuthEndpoint'
                        >
                            {formatMessage(messages.authTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AuthEndpoint'
                                ref='AuthEndpoint'
                                placeholder={formatMessage(messages.authExample)}
                                defaultValue={this.props.config.GitLabSettings.AuthEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{formatMessage(messages.authDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='TokenEndpoint'
                        >
                            {formatMessage(messages.tokenTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='TokenEndpoint'
                                ref='TokenEndpoint'
                                placeholder={formatMessage(messages.tokenExample)}
                                defaultValue={this.props.config.GitLabSettings.TokenEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{formatMessage(messages.tokenDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='UserApiEndpoint'
                        >
                            {formatMessage(messages.userTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='UserApiEndpoint'
                                ref='UserApiEndpoint'
                                placeholder={formatMessage(messages.userExample)}
                                defaultValue={this.props.config.GitLabSettings.UserApiEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{formatMessage(messages.userDescription)}</p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.saving)}
                            >
                                {formatMessage(messages.save)}
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
