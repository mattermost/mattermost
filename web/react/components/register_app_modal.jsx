// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import ModalStore from '../stores/modal_store.jsx';

const Modal = ReactBootstrap.Modal;

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

export default class RegisterAppModal extends React.Component {
    constructor() {
        super();

        this.handleSubmit = this.handleSubmit.bind(this);
        this.onHide = this.onHide.bind(this);
        this.save = this.save.bind(this);
        this.updateShow = this.updateShow.bind(this);

        this.state = {
            clientId: '',
            clientSecret: '',
            saved: false,
            show: false
        };
    }
    componentDidMount() {
        ModalStore.addModalListener(ActionTypes.TOGGLE_REGISTER_APP_MODAL, this.updateShow);
    }
    componentWillUnmount() {
        ModalStore.removeModalListener(ActionTypes.TOGGLE_REGISTER_APP_MODAL, this.updateShow);
    }
    updateShow(show) {
        if (!show) {
            if (this.state.clientId !== '' && !this.state.saved) {
                return;
            }

            this.setState({
                clientId: '',
                clientSecret: '',
                saved: false,
                homepageError: null,
                callbackError: null,
                serverError: null,
                nameError: null
            });
        }

        this.setState({show});
    }
    handleSubmit(e) {
        e.preventDefault();

        var state = this.state;
        state.serverError = null;

        var app = {};

        var name = this.refs.name.value;
        if (!name || name.length === 0) {
            state.nameError = 'Application name must be filled in.';
            this.setState(state);
            return;
        }
        state.nameError = null;
        app.name = name;

        var homepage = this.refs.homepage.value;
        if (!homepage || homepage.length === 0) {
            state.homepageError = 'Homepage must be filled in.';
            this.setState(state);
            return;
        }
        state.homepageError = null;
        app.homepage = homepage;

        var desc = this.refs.desc.value;
        app.description = desc;

        var rawCallbacks = this.refs.callback.value.trim();
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
        this.setState({saved: this.refs.save.checked});
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
        var footer = '';
        if (this.state.clientId === '') {
            body = (
                <div className='settings-modal'>
                    <div className='form-horizontal user-settings'>
                        <h4 className='padding-bottom x3'>{'Register a New Application'}</h4>
                        <div className='row'>
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
                        </div>
                        <div className='row padding-top x2'>
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
                        </div>
                        <div className='row padding-top x2'>
                            <label className='col-sm-4 control-label'>{'Description'}</label>
                            <div className='col-sm-7'>
                                <input
                                    ref='desc'
                                    className='form-control'
                                    type='text'
                                    placeholder='Optional'
                                />
                            </div>
                        </div>
                        <div className='row padding-top padding-bottom x2'>
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
                        </div>
                        {serverError}
                    </div>
                </div>
            );

            footer = (
                <div>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={() => this.updateShow(false)}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        onClick={this.handleSubmit}
                        type='submit'
                        className='btn btn-primary'
                        tabIndex='3'
                    >
                        {'Register'}
                    </button>
                </div>
            );
        } else {
            var btnClass = ' disabled';
            if (this.state.saved) {
                btnClass = '';
            }

            body = (
                <div className='form-horizontal user-settings'>
                    <h4 className='padding-bottom x3'>{'Your Application Credentials'}</h4>
                    <br/>
                    <div className='row'>
                        <label className='col-sm-4 control-label'>{'Client ID'}</label>
                        <div className='col-sm-7'>
                            <input
                                className='form-control'
                                type='text'
                                value={this.state.clientId}
                                readOnly='true'
                            />
                        </div>
                    </div>
                    <br/>
                    <div className='row padding-top x2'>
                        <label className='col-sm-4 control-label'>{'Client Secret'}</label>
                        <div className='col-sm-7'>
                            <input
                                className='form-control'
                                type='text'
                                value={this.state.clientSecret}
                                readOnly='true'
                            />
                        </div>
                    </div>
                    <br/>
                    <br/>
                    <strong>{'Save these somewhere SAFE and SECURE. Treat your Client ID as your app\'s username and your Client Secret as the app\'s password.'}</strong>
                    <br/>
                    <br/>
                    <div className='checkbox'>
                        <label>
                            <input
                                ref='save'
                                type='checkbox'
                                checked={this.state.saved}
                                onChange={this.save}
                            />
                            {'I have saved both my Client Id and Client Secret somewhere safe'}
                        </label>
                    </div>
                </div>
            );

            footer = (
                <a
                    className={'btn btn-sm btn-primary pull-right' + btnClass}
                    href='#'
                    onClick={(e) => {
                        e.preventDefault();
                        this.updateShow(false);
                    }}
                >
                    {'Close'}
                </a>
            );
        }

        return (
            <span>
                <Modal
                    show={this.state.show}
                    onHide={() => this.updateShow(false)}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>{'Developer Applications'}</Modal.Title>
                    </Modal.Header>
                    <form
                        role='form'
                        className='form-horizontal'
                    >
                        <Modal.Body>
                            {body}
                        </Modal.Body>
                        <Modal.Footer>
                            {footer}
                        </Modal.Footer>
                    </form>
                </Modal>
            </span>
        );
    }
}

