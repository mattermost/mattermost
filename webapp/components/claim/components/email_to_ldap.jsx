// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginMfa from 'components/login/components/login_mfa.jsx';

import * as Utils from 'utils/utils.jsx';

import {checkMfa} from 'actions/user_actions.jsx';
import {emailToLdap} from 'actions/admin_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class EmailToLDAP extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);
        this.preSubmit = this.preSubmit.bind(this);

        this.state = {
            passwordError: '',
            ldapError: '',
            ldapPasswordError: '',
            serverError: '',
            showMfa: false
        };
    }

    preSubmit(e) {
        e.preventDefault();

        var state = {
            passwordError: '',
            ldapError: '',
            ldapPasswordError: '',
            serverError: ''
        };

        const password = this.refs.emailpassword.value;
        if (!password) {
            state.passwordError = Utils.localizeMessage('claim.email_to_ldap.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        const ldapId = this.refs.ldapid.value.trim();
        if (!ldapId) {
            state.ldapError = Utils.localizeMessage('claim.email_to_ldap.ldapIdError', 'Please enter your AD/LDAP ID.');
            this.setState(state);
            return;
        }

        const ldapPassword = this.refs.ldappassword.value;
        if (!ldapPassword) {
            state.ldapPasswordError = Utils.localizeMessage('claim.email_to_ldap.ldapPasswordError', 'Please enter your AD/LDAP password.');
            this.setState(state);
            return;
        }

        state.password = password;
        state.ldapId = ldapId;
        state.ldapPassword = ldapPassword;
        this.setState(state);

        checkMfa(
            this.props.email,
            (requiresMfa) => {
                if (requiresMfa) {
                    this.setState({showMfa: true});
                } else {
                    this.submit(this.props.email, password, '', ldapId, ldapPassword);
                }
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }

    submit(loginId, password, token, ldapId, ldapPassword) {
        emailToLdap(
            loginId,
            password,
            token,
            ldapId || this.state.ldapId,
            ldapPassword || this.state.ldapPassword,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (err) => {
                this.setState({serverError: err.message, showMfa: false});
            }
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

        let ldapError = null;
        let ldapClass = 'form-group';
        if (this.state.ldapError) {
            ldapError = <div className='form-group has-error'><label className='control-label'>{this.state.ldapError}</label></div>;
            ldapClass += ' has-error';
        }

        let ldapPasswordError = null;
        let ldapPasswordClass = 'form-group';
        if (this.state.ldapPasswordError) {
            ldapPasswordError = <div className='form-group has-error'><label className='control-label'>{this.state.ldapPasswordError}</label></div>;
            ldapPasswordClass += ' has-error';
        }

        let loginPlaceholder;
        if (global.window.mm_config.LdapLoginFieldName) {
            loginPlaceholder = global.window.mm_config.LdapLoginFieldName;
        } else {
            loginPlaceholder = Utils.localizeMessage('claim.email_to_ldap.ldapId', 'AD/LDAP ID');
        }

        let passwordPlaceholder;
        if (global.window.mm_config.LdapPasswordFieldName) {
            passwordPlaceholder = global.window.mm_config.LdapPasswordFieldName;
        } else {
            passwordPlaceholder = Utils.localizeMessage('claim.email_to_ldap.ldapPwd', 'AD/LDAP Password');
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
                            id='claim.email_to_ldap.ssoType'
                            defaultMessage='Upon claiming your account, you will only be able to login with AD/LDAP'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.ssoNote'
                            defaultMessage='You must already have a valid AD/LDAP account'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.enterPwd'
                            defaultMessage='Enter the password for your {site} email account'
                            values={{
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <input
                        type='text'
                        style={{display: 'none'}}
                        name='fakeusernameremembered'
                    />
                    <div className={passwordClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='emailPassword'
                            ref='emailpassword'
                            autoComplete='off'
                            placeholder={Utils.localizeMessage('claim.email_to_ldap.pwd', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    {passwordError}
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.enterLdapPwd'
                            defaultMessage='Enter the ID and password for your AD/LDAP account'
                        />
                    </p>
                    <div className={ldapClass}>
                        <input
                            type='text'
                            className='form-control'
                            name='ldapId'
                            ref='ldapid'
                            autoComplete='off'
                            placeholder={loginPlaceholder}
                            spellCheck='false'
                        />
                    </div>
                    {ldapError}
                    <div className={ldapPasswordClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='ldapPassword'
                            ref='ldappassword'
                            autoComplete='off'
                            placeholder={passwordPlaceholder}
                            spellCheck='false'
                        />
                    </div>
                    {ldapPasswordError}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.email_to_ldap.switchTo'
                            defaultMessage='Switch account to AD/LDAP'
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
                        id='claim.email_to_ldap.title'
                        defaultMessage='Switch Email/Password Account to AD/LDAP'
                    />
                </h3>
                {content}
            </div>
        );
    }
}

EmailToLDAP.defaultProps = {
};
EmailToLDAP.propTypes = {
    email: PropTypes.string
};
