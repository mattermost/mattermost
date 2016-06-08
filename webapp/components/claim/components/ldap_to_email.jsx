// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {switchFromLdapToEmail} from 'actions/user_actions.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

export default class LDAPToEmail extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {
            passwordError: '',
            confirmError: '',
            ldapPasswordError: '',
            serverError: ''
        };
    }

    submit(e) {
        e.preventDefault();
        var state = {
            passwordError: '',
            confirmError: '',
            ldapPasswordError: '',
            serverError: ''
        };

        const ldapPassword = ReactDOM.findDOMNode(this.refs.ldappassword).value;
        if (!ldapPassword) {
            state.ldapPasswordError = Utils.localizeMessage('claim.ldap_to_email.ldapPasswordError', 'Please enter your LDAP password.');
            this.setState(state);
            return;
        }

        const password = ReactDOM.findDOMNode(this.refs.password).value;
        if (!password) {
            state.passwordError = Utils.localizeMessage('claim.ldap_to_email.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        const passwordErr = Utils.isValidPassword(password);
        if (passwordErr !== '') {
            this.setState({
                passwordError: passwordErr
            });
            return;
        }

        const confirmPassword = ReactDOM.findDOMNode(this.refs.passwordconfirm).value;
        if (!confirmPassword || password !== confirmPassword) {
            state.error = Utils.localizeMessage('claim.ldap_to_email.pwdNotMatch', 'Passwords do not match.');
            this.setState(state);
            return;
        }

        this.setState(state);

        switchFromLdapToEmail(
            this.props.email,
            password,
            ldapPassword,
            null,
            (err) => this.setState({serverError: err.message})
        );
    }

    render() {
        let serverError = null;
        let formClass = 'form-group';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
            formClass += ' has-error';
        }

        let passwordError = null;
        let passwordClass = 'form-group';
        if (this.state.passwordError) {
            passwordError = <div className='form-group has-error'><label className='control-label'>{this.state.passwordError}</label></div>;
            passwordClass += ' has-error';
        }

        let ldapPasswordError = null;
        let ldapPasswordClass = 'form-group';
        if (this.state.ldapPasswordError) {
            ldapPasswordError = <div className='form-group has-error'><label className='control-label'>{this.state.ldapPasswordError}</label></div>;
            ldapPasswordClass += ' has-error';
        }

        let confirmError = null;
        let confimClass = 'form-group';
        if (this.state.confirmError) {
            confirmError = <div className='form-group has-error'><label className='control-label'>{this.state.confirmError}</label></div>;
            confimClass += ' has-error';
        }

        let passwordPlaceholder;
        if (global.window.mm_config.LdapPasswordFieldName) {
            passwordPlaceholder = global.window.mm_config.LdapPasswordFieldName;
        } else {
            passwordPlaceholder = Utils.localizeMessage('claim.ldap_to_email.ldapPwd', 'LDAP Password');
        }

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.ldap_to_email.title'
                        defaultMessage='Switch LDAP Account to Email/Password'
                    />
                </h3>
                <form
                    onSubmit={this.submit}
                    className={formClass}
                >
                    <p>
                        <FormattedMessage
                            id='claim.ldap_to_email.ssoType'
                            defaultMessage='Upon claiming your account, you will only be able to login with your email and password'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.ldap_to_email.email'
                            defaultMessage='You will use the email {email} to login'
                            values={{
                                email: this.props.email
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.ldap_to_email.enterLdapPwd'
                            defaultMessage='Enter your {ldapPassword} for your {site} email account'
                            values={{
                                ldapPassword: passwordPlaceholder,
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <div className={ldapPasswordClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='ldapPassword'
                            ref='ldappassword'
                            placeholder={passwordPlaceholder}
                            spellCheck='false'
                        />
                    </div>
                    {ldapPasswordError}
                    <p>
                        <FormattedMessage
                            id='claim.ldap_to_email.enterPwd'
                            defaultMessage='Enter a new password for your email account'
                        />
                    </p>
                    <div className={passwordClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder={Utils.localizeMessage('claim.ldap_to_email.pwd', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    {passwordError}
                    <div className={confimClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='passwordconfirm'
                            ref='passwordconfirm'
                            placeholder={Utils.localizeMessage('claim.ldap_to_email.confirm', 'Confirm Password')}
                            spellCheck='false'
                        />
                    </div>
                    {confirmError}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.ldap_to_email.switchTo'
                            defaultMessage='Switch account to email/password'
                        />
                    </button>
                    {serverError}
                </form>
            </div>
        );
    }
}

LDAPToEmail.defaultProps = {
};
LDAPToEmail.propTypes = {
    email: React.PropTypes.string
};
