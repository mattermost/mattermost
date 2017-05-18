// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

import PropTypes from 'prop-types';

import React from 'react';

export default class LoginMfa extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            serverError: ''
        };
    }

    handleSubmit(e) {
        e.preventDefault();
        const state = {};

        const token = this.refs.token.value.trim().replace(/\s/g, '');
        if (!token) {
            state.serverError = Utils.localizeMessage('login_mfa.tokenReq', 'Please enter an MFA token');
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        this.props.submit(this.props.loginId, this.props.password, token);
    }

    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <p>
                        <FormattedMessage
                            id='login_mfa.enterToken'
                            defaultMessage="To complete the sign in process, please enter a token from your smartphone's authenticator"
                        />
                    </p>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            type='text'
                            className='form-control'
                            name='token'
                            ref='token'
                            placeholder={Utils.localizeMessage('login_mfa.token', 'MFA Token')}
                            spellCheck='false'
                            autoComplete='off'
                            autoFocus={true}
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_mfa.submit'
                                defaultMessage='Submit'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginMfa.defaultProps = {
};

LoginMfa.propTypes = {
    loginId: PropTypes.string.isRequired,
    password: PropTypes.string.isRequired,
    submit: PropTypes.func.isRequired
};
