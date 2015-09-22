// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class GitLabSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            Allow: this.props.config.GitLabSettings.Allow,
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'AllowTrue') {
            s.Allow = true;
        }

        if (action === 'AllowFalse') {
            s.Allow = false;
        }

        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.GitLabSettings.Allow = React.findDOMNode(this.refs.Allow).checked;
        config.GitLabSettings.Secret = React.findDOMNode(this.refs.Secret).value.trim();
        config.GitLabSettings.Id = React.findDOMNode(this.refs.Id).value.trim();
        config.GitLabSettings.Scope = React.findDOMNode(this.refs.Scope).value.trim();
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
                            htmlFor='Allow'
                        >
                            {'Enable Sign Up With GitLab: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Allow'
                                    value='true'
                                    ref='Allow'
                                    defaultChecked={this.props.config.GitLabSettings.Allow}
                                    onChange={this.handleChange.bind(this, 'AllowTrue')}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Allow'
                                    value='false'
                                    defaultChecked={!this.props.config.GitLabSettings.Allow}
                                    onChange={this.handleChange.bind(this, 'AllowFalse')}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true Mattermost will allow team creation and account signup utilizing GitLab OAuth.'}</p>
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
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
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
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Scope'
                        >
                            {'Scope:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Scope'
                                ref='Scope'
                                placeholder='Ex ""'
                                defaultValue={this.props.config.GitLabSettings.Scope}
                                onChange={this.handleChange}
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
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
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
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
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
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
                                disabled={!this.state.Allow}
                            />
                            <p className='help-text'>{'Need help text.'}</p>
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

GitLabSettings.propTypes = {
    config: React.PropTypes.object
};
