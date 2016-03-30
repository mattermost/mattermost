// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class LoginUsername extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            serverError: props.serverError
        };
    }
    componentWillReceiveProps(nextProps) {
        this.setState({serverError: nextProps.serverError});
    }
    handleSubmit(e) {
        e.preventDefault();
        const state = {};

        const username = this.refs.username.value.trim();
        if (!username) {
            state.serverError = Utils.localizeMessage('login_username.usernameReq', 'A username is required');
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = Utils.localizeMessage('login_username.pwdReq', 'A password is required');
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        this.props.submit(Constants.USERNAME_SERVICE, username, password);
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        let priorUsername = UserStore.getLastUsername();
        let focusUsername = false;
        let focusPassword = false;
        if (priorUsername === '') {
            focusUsername = true;
        } else {
            focusPassword = true;
        }

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorUsername = decodeURIComponent(emailParam);
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusUsername}
                            type='username'
                            className='form-control'
                            name='username'
                            defaultValue={priorUsername}
                            ref='username'
                            placeholder={Utils.localizeMessage('login_username.username', 'Username')}
                            spellCheck='false'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusPassword}
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder={Utils.localizeMessage('login_username.pwd', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_username.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginUsername.defaultProps = {
};

LoginUsername.propTypes = {
    serverError: React.PropTypes.string,
    submit: React.PropTypes.func.isRequired
};
