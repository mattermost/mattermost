// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class LoginLdap extends React.Component {
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

        const id = this.refs.id.value.trim();
        if (!id) {
            state.serverError = Utils.localizeMessage('login_ldap.idlReq', 'An LDAP ID is required');
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = Utils.localizeMessage('login_ldap.pwdReq', 'An LDAP password is required');
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        this.props.submit(Constants.LDAP_SERVICE, id, password);
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        let loginPlaceholder;
        if (global.window.mm_config.LdapLoginFieldName) {
            loginPlaceholder = global.window.mm_config.LdapLoginFieldName;
        } else {
            loginPlaceholder = Utils.localizeMessage('login_ldap.username', 'LDAP Username');
        }

        let passwordPlaceholder;
        if (global.window.mm_config.LdapPasswordFieldName) {
            passwordPlaceholder = global.window.mm_config.LdapPasswordFieldName;
        } else {
            passwordPlaceholder = Utils.localizeMessage('login_ldap.pwd', 'LDAP Password');
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={true}
                            className='form-control'
                            ref='id'
                            placeholder={loginPlaceholder}
                            spellCheck='false'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            type='password'
                            className='form-control'
                            ref='password'
                            placeholder={passwordPlaceholder}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_ldap.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginLdap.defaultProps = {
};

LoginLdap.propTypes = {
    serverError: React.PropTypes.string,
    submit: React.PropTypes.func.isRequired
};
