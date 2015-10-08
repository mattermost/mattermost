// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class GitLabSettings extends React.Component {
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
        config.GitLabSettings.Enable = React.findDOMNode(this.refs.Enable).checked;
        config.GitLabSettings.Secret = React.findDOMNode(this.refs.Secret).value.trim();
        config.GitLabSettings.Id = React.findDOMNode(this.refs.Id).value.trim();
        config.GitLabSettings.AuthEndpoint = React.findDOMNode(this.refs.AuthEndpoint).value.trim();
        config.GitLabSettings.TokenEndpoint = React.findDOMNode(this.refs.TokenEndpoint).value.trim();
        config.GitLabSettings.UserApiEndpoint = React.findDOMNode(this.refs.UserApiEndpoint).value.trim();

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

                <h3>{'GitLab Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            {'Enable Sign Up With GitLab: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.GitLabSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableFalse')}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, Mattermost allows team creation and account signup using GitLab OAuth. To configure, log in to your GitLab account and go to Applications -> Profile Settings. Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete". Then use "Secret" and "Id" fields to complete the options below.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Id'
                        >
                            {'Id:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Id'
                                ref='Id'
                                placeholder='Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
                                defaultValue={this.props.config.GitLabSettings.Id}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{'Obtain this value via the instructions above for logging into GitLab'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Secret'
                        >
                            {'Secret:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Secret'
                                ref='Secret'
                                placeholder='Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
                                defaultValue={this.props.config.GitLabSettings.Secret}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{'Obtain this value via the instructions above for logging into GitLab.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AuthEndpoint'
                        >
                            {'Auth Endpoint:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AuthEndpoint'
                                ref='AuthEndpoint'
                                placeholder='Ex ""'
                                defaultValue={this.props.config.GitLabSettings.AuthEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{'Enter <your-gitlab-url>/oauth/authorize (example http://localhost:3000/oauth/authorize).  Make sure you use HTTP or HTTPS in your URLs as appropriate.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='TokenEndpoint'
                        >
                            {'Token Endpoint:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='TokenEndpoint'
                                ref='TokenEndpoint'
                                placeholder='Ex ""'
                                defaultValue={this.props.config.GitLabSettings.TokenEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{'Enter <your-gitlab-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URLs as appropriate.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='UserApiEndpoint'
                        >
                            {'User API Endpoint:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='UserApiEndpoint'
                                ref='UserApiEndpoint'
                                placeholder='Ex ""'
                                defaultValue={this.props.config.GitLabSettings.UserApiEndpoint}
                                onChange={this.handleChange}
                                disabled={!this.state.Enable}
                            />
                            <p className='help-text'>{'Enter <your-gitlab-url>/api/v3/user.  Make sure you use HTTP or HTTPS in your URLs as appropriate.'}</p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Saving Config...'}
                            >
                                {'Save'}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}


//config.GitLabSettings.Scope = React.findDOMNode(this.refs.Scope).value.trim();
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
    config: React.PropTypes.object
};
