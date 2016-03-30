// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import UserStore from 'stores/user_store.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class LoginEmail extends React.Component {
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
        var state = {};

        const email = this.refs.email.value.trim();
        if (!email) {
            state.serverError = Utils.localizeMessage('login_email.emailReq', 'An email is required');
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = Utils.localizeMessage('login_email.pwdReq', 'A password is required');
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        this.props.submit(Constants.EMAIL_SERVICE, email, password);
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        let priorEmail = UserStore.getLastEmail();
        let focusEmail = false;
        let focusPassword = false;
        if (priorEmail === '') {
            focusEmail = true;
        } else {
            focusPassword = true;
        }

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusEmail}
                            type='email'
                            className='form-control'
                            name='email'
                            defaultValue={priorEmail}
                            ref='email'
                            placeholder={Utils.localizeMessage('login_email.email', 'Email')}
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
                            placeholder={Utils.localizeMessage('login_email.pwd', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_email.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginEmail.defaultProps = {
};

LoginEmail.propTypes = {
    submit: React.PropTypes.func.isRequired,
    serverError: React.PropTypes.string
};
