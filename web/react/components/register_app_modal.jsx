// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');

export default class RegisterAppModal extends React.Component {
    constructor() {
        super();

        this.register = this.register.bind(this);
        this.onHide = this.onHide.bind(this);
        this.save = this.save.bind(this);

        this.state = {clientId: '', clientSecret: '', saved: false};
    }
    componentDidMount() {
        $(React.findDOMNode(this)).on('hide.bs.modal', this.onHide);
    }
    register() {
        var state = this.state;
        state.serverError = null;

        var app = {};

        var name = this.refs.name.getDOMNode().value;
        if (!name || name.length === 0) {
            state.nameError = 'Application name must be filled in.';
            this.setState(state);
            return;
        }
        state.nameError = null;
        app.name = name;

        var homepage = this.refs.homepage.getDOMNode().value;
        if (!homepage || homepage.length === 0) {
            state.homepageError = 'Homepage must be filled in.';
            this.setState(state);
            return;
        }
        state.homepageError = null;
        app.homepage = homepage;

        var desc = this.refs.desc.getDOMNode().value;
        app.description = desc;

        var rawCallbacks = this.refs.callback.getDOMNode().value.trim();
        if (!rawCallbacks || rawCallbacks.length === 0) {
            state.callbackError = 'At least one callback URL must be filled in.';
            this.setState(state);
            return;
        }
        state.callbackError = null;
        app.callback_urls = rawCallbacks.split('\n');

        Client.registerOAuthApp(app,
            (data) => {
                state.clientId = data.id;
                state.clientSecret = data.client_secret;
                this.setState(state);
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    onHide(e) {
        if (!this.state.saved && this.state.clientId !== '') {
            e.preventDefault();
            return;
        }

        this.setState({clientId: '', clientSecret: '', saved: false});
    }
    save() {
        this.setState({saved: this.refs.save.getDOMNode().checked});
    }
    render() {
        var nameError;
        if (this.state.nameError) {
            nameError = <div className='form-group has-error'><label className='control-label'>{this.state.nameError}</label></div>;
        }
        var homepageError;
        if (this.state.homepageError) {
            homepageError = <div className='form-group has-error'><label className='control-label'>{this.state.homepageError}</label></div>;
        }
        var callbackError;
        if (this.state.callbackError) {
            callbackError = <div className='form-group has-error'><label className='control-label'>{this.state.callbackError}</label></div>;
        }
        var serverError;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var body = '';
        if (this.state.clientId === '') {
            body = (
                <div className='form-group user-settings'>
                    <h3>{'Register a New Application'}</h3>
                    <br/>
                    <label className='col-sm-4 control-label'>{'Application Name'}</label>
                    <div className='col-sm-7'>
                        <input
                            ref='name'
                            className='form-control'
                            type='text'
                            placeholder='Required'
                        />
                        {nameError}
                    </div>
                    <br/>
                    <br/>
                    <label className='col-sm-4 control-label'>{'Homepage URL'}</label>
                    <div className='col-sm-7'>
                        <input
                            ref='homepage'
                            className='form-control'
                            type='text'
                            placeholder='Required'
                        />
                        {homepageError}
                    </div>
                    <br/>
                    <br/>
                    <label className='col-sm-4 control-label'>{'Description'}</label>
                    <div className='col-sm-7'>
                        <input
                            ref='desc'
                            className='form-control'
                            type='text'
                            placeholder='Optional'
                        />
                    </div>
                    <br/>
                    <br/>
                    <label className='col-sm-4 control-label'>{'Callback URL'}</label>
                    <div className='col-sm-7'>
                        <textarea
                            ref='callback'
                            className='form-control'
                            type='text'
                            placeholder='Required'
                            rows='5'
                        />
                        {callbackError}
                    </div>
                    <br/>
                    <br/>
                    <br/>
                    <br/>
                    <br/>
                    {serverError}
                    <a
                        className='btn btn-sm theme pull-right'
                        href='#'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        {'Cancel'}
                    </a>
                    <a
                        className='btn btn-sm btn-primary pull-right'
                        onClick={this.register}
                    >
                        {'Register'}
                    </a>
                </div>
            );
        } else {
            var btnClass = ' disabled';
            if (this.state.saved) {
                btnClass = '';
            }

            body = (
                <div className='form-group user-settings'>
                    <h3>{'Your Application Credentials'}</h3>
                    <br/>
                    <br/>
                    <label className='col-sm-12 control-label'>{'Client ID: '}{this.state.clientId}</label>
                    <label className='col-sm-12 control-label'>{'Client Secret: '}{this.state.clientSecret}</label>
                    <br/>
                    <br/>
                    <br/>
                    <br/>
                    <strong>{'Save these somewhere SAFE and SECURE. We can retrieve your Client Id if you lose it, but your Client Secret will be lost forever if you were to lose it.'}</strong>
                    <br/>
                    <br/>
                    <div className='checkbox'>
                        <label>
                            <input
                                ref='save'
                                type='checkbox'
                                checked={this.state.saved}
                                onClick={this.save}
                            >
                                {'I have saved both my Client Id and Client Secret somewhere safe'}
                            </input>
                        </label>
                    </div>
                    <a
                        className={'btn btn-sm btn-primary pull-right' + btnClass}
                        href='#'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        {'Close'}
                    </a>
                </div>
            );
        }

        return (
        <div
            className='modal fade'
            ref='modal'
            id='register_app'
            role='dialog'
            aria-hidden='true'
        >
            <div className='modal-dialog'>
                <div className='modal-content'>
                    <div className='modal-header'>
                        <button
                            type='button'
                            className='close'
                            data-dismiss='modal'
                            aria-label='Close'
                        >
                            <span aria-hidden='true'>{'x'}</span>
                        </button>
                        <h4
                            className='modal-title'
                            ref='title'
                        >
                            {'Developer Applications'}
                        </h4>
                    </div>
                    <div className='modal-body'>
                        {body}
                    </div>
                </div>
            </div>
        </div>
        );
    }
}

