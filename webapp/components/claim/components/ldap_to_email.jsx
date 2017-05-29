// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginMfa from 'components/login/components/login_mfa.jsx';

import * as Utils from 'utils/utils.jsx';

import {checkMfa, switchFromLdapToEmail} from 'actions/user_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class LDAPToEmail extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);
        this.preSubmit = this.preSubmit.bind(this);

        this.state = {
            passwordError: '',
            confirmError: '',
            ldapPasswordError: '',
            serverError: ''
        };
    }

    preSubmit(e) {
        e.preventDefault();

        var state = {
            passwordError: '',
            confirmError: '',
            ldapPasswordError: '',
            serverError: ''
        };

        const ldapPassword = this.refs.ldappassword.value;
        if (!ldapPassword) {
            state.ldapPasswordError = Utils.localizeMessage('claim.ldap_to_email.ldapPasswordError', 'Please enter your AD/LDAP password.');
            this.setState(state);
            return;
        }

        const password = this.refs.password.value;
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

        const confirmPassword = this.refs.passwordconfirm.value;
        if (!confirmPassword || password !== confirmPassword) {
            state.confirmError = Utils.localizeMessage('claim.ldap_to_email.pwdNotMatch', 'Passwords do not match.');
            this.setState(state);
            return;
        }

        state.password = password;
        state.ldapPassword = ldapPassword;
        this.setState(state);

        checkMfa(
            this.props.email,
            (requiresMfa) => {
                if (requiresMfa) {
                    this.setState({showMfa: true});
                } else {
                    this.submit(this.props.email, password, '', ldapPassword);
                }
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }

    submit(loginId, password, token, ldapPassword) {
        switchFromLdapToEmail(
            this.props.email,
            password,
            token,
            ldapPassword || this.state.ldapPassword,
            null,
            (err) => this.setState({serverError: err.message, showMfa: false})
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
            passwordPlaceholder = Utils.localizeMessage('claim.ldap_to_email.ldapPwd', 'AD/LDAP Password');
        }

        let content;
        if (this.state.showMfa) {
            content = (
                <LoginMfa
                    loginId={this.props.email}
                    password={this.state.password}
                    submit={this.submit}
                />
            );
        } else {
            content = (
                <form
                    onSubmit={this.preSubmit}
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
            );
        }

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.ldap_to_email.title'
                        defaultMessage='Switch AD/LDAP Account to Email/Password'
                    />
                </h3>
                {content}
            </div>
        );
    }
}

LDAPToEmail.defaultProps = {
};
LDAPToEmail.propTypes = {
    email: PropTypes.string
};
