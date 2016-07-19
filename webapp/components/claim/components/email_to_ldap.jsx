// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

export default class EmailToLDAP extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {
            passwordError: '',
            ldapError: '',
            ldapPasswordError: '',
            serverError: ''
        };
    }
    submit(e) {
        e.preventDefault();
        var state = {
            passwordError: '',
            ldapError: '',
            ldapPasswordError: '',
            serverError: ''
        };

        const password = ReactDOM.findDOMNode(this.refs.emailpassword).value;
        if (!password) {
            state.passwordError = Utils.localizeMessage('claim.email_to_ldap.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        const ldapId = ReactDOM.findDOMNode(this.refs.ldapid).value.trim();
        if (!ldapId) {
            state.ldapError = Utils.localizeMessage('claim.email_to_ldap.ldapIdError', 'Please enter your LDAP ID.');
            this.setState(state);
            return;
        }

        const ldapPassword = ReactDOM.findDOMNode(this.refs.ldappassword).value;
        if (!ldapPassword) {
            state.ldapPasswordError = Utils.localizeMessage('claim.email_to_ldap.ldapPasswordError', 'Please enter your LDAP password.');
            this.setState(state);
            return;
        }

        this.setState(state);

        Client.emailToLdap(
            this.props.email,
            password,
            ldapId,
            ldapPassword,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (err) => {
                this.setState({serverError: err.message});
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
            loginPlaceholder = Utils.localizeMessage('claim.email_to_ldap.ldapId', 'LDAP ID');
        }

        let passwordPlaceholder;
        if (global.window.mm_config.LdapPasswordFieldName) {
            passwordPlaceholder = global.window.mm_config.LdapPasswordFieldName;
        } else {
            passwordPlaceholder = Utils.localizeMessage('claim.email_to_ldap.ldapPwd', 'LDAP Password');
        }

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.email_to_ldap.title'
                        defaultMessage='Switch Email/Password Account to LDAP'
                    />
                </h3>
                <form
                    onSubmit={this.submit}
                    className={formClass}
                >
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.ssoType'
                            defaultMessage='Upon claiming your account, you will only be able to login with LDAP'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_ldap.ssoNote'
                            defaultMessage='You must already have a valid LDAP account'
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
                            defaultMessage='Enter the ID and password for your LDAP account'
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
                            defaultMessage='Switch account to LDAP'
                        />
                    </button>
                    {serverError}
                </form>
            </div>
        );
    }
}

EmailToLDAP.defaultProps = {
};
EmailToLDAP.propTypes = {
    email: React.PropTypes.string
};
