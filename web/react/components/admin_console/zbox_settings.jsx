// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

const messages = defineMessages({
    true: {
        id: 'admin.zbox.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.zbox.false',
        defaultMessage: 'false'
    },
    title: {
        id: 'admin.zbox.title',
        defaultMessage: 'ZBox Settings'
    },
    enableTitle: {
        id: 'admin.zbox.enableTitle',
        defaultMessage: 'Enable Login With ZBox: '
    },
    enableDescription: {
        id: 'admin.zbox.enableDescription',
        defaultMessage: 'When true, Mattermost allows account signup and login using ZBox OAuth. To configure, set the "Id", "Secret" and the Endpoints fields to complete the options below.'
    },
    clientIdTitle: {
        id: 'admin.zbox.clientIdTitle',
        defaultMessage: 'Id:'
    },
    clientIdExample: {
        id: 'admin.zbox.clientIdExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    clientIdDescription: {
        id: 'admin.zbox.clientIdDescription',
        defaultMessage: 'Set the client id provided by ZBoxOAuth2 service.'
    },
    clientSecretTitle: {
        id: 'admin.zbox.clientSecretTitle',
        defaultMessage: 'Secret:'
    },
    clientSecretExample: {
        id: 'admin.zbox.clientSecretExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    clientSecretDescription: {
        id: 'admin.zbox.clientSecretDescription',
        defaultMessage: 'Set the client secret provided by ZBoxOAuth2 service.'
    },
    authTitle: {
        id: 'admin.zbox.authTitle',
        defaultMessage: 'Auth Endpoint:'
    },
    authExample: {
        id: 'admin.zbox.authExample',
        defaultMessage: 'Ex ""'
    },
    authDescription: {
        id: 'admin.zbox.authDescription',
        defaultMessage: 'Enter <your-zboxoauth2-url>/oauth/authorize (example http://localhost:3000/oauth/authorize).  Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    tokenTitle: {
        id: 'admin.zbox.tokenTitle',
        defaultMessage: 'Token Endpoint:'
    },
    tokenExample: {
        id: 'admin.zbox.tokenExample',
        defaultMessage: 'Ex ""'
    },
    tokenDescription: {
        id: 'admin.zbox.tokenDescription',
        defaultMessage: 'Enter <your-zboxoauth2-url>/oauth/token.   Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    userTitle: {
        id: 'admin.zbox.userTitle',
        defaultMessage: 'User API Endpoint:'
    },
    userExample: {
        id: 'admin.zbox.userExample',
        defaultMessage: 'Ex ""'
    },
    userDescription: {
        id: 'admin.zbox.userDescription',
        defaultMessage: 'Enter <your-zboxoauth2-url>/me.  Make sure you use HTTP or HTTPS in your URLs as appropriate.'
    },
    saving: {
        id: 'admin.zbox.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.zbox.save',
        defaultMessage: 'Save'
    }
});

class ZBoxSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            Enable: this.props.config.ZBoxSettings.Enable,
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
        config.ZBoxSettings.Enable = ReactDOM.findDOMNode(this.refs.Enable).checked;
        config.ZBoxSettings.Secret = ReactDOM.findDOMNode(this.refs.Secret).value.trim();
        config.ZBoxSettings.Id = ReactDOM.findDOMNode(this.refs.Id).value.trim();
        config.ZBoxSettings.AuthEndpoint = ReactDOM.findDOMNode(this.refs.AuthEndpoint).value.trim();
        config.ZBoxSettings.TokenEndpoint = ReactDOM.findDOMNode(this.refs.TokenEndpoint).value.trim();
        config.ZBoxSettings.UserApiEndpoint = ReactDOM.findDOMNode(this.refs.UserApiEndpoint).value.trim();

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

                <h3>{formatMessage(messages.title)}</h3>
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
                                    defaultChecked={this.props.config.ZBoxSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableTrue')}
                                />
                                {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.ZBoxSettings.Enable}
                                    onChange={this.handleChange.bind(this, 'EnableFalse')}
                                />
                                {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.enableDescription)}</p>
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
                                defaultValue={this.props.config.ZBoxSettings.Id}
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
                                defaultValue={this.props.config.ZBoxSettings.Secret}
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
                                defaultValue={this.props.config.ZBoxSettings.AuthEndpoint}
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
                                defaultValue={this.props.config.ZBoxSettings.TokenEndpoint}
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
                                defaultValue={this.props.config.ZBoxSettings.UserApiEndpoint}
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

ZBoxSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(ZBoxSettings);