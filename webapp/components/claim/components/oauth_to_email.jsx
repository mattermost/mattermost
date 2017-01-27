// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';
import {browserHistory} from 'react-router/es6';

export default class OAuthToEmail extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }

    submit(e) {
        e.preventDefault();
        const state = {};

        const password = ReactDOM.findDOMNode(this.refs.password).value;
        if (!password) {
            state.error = Utils.localizeMessage('claim.oauth_to_email.enterPwd', 'Please enter a password.');
            this.setState(state);
            return;
        }

        const passwordErr = Utils.isValidPassword(password);
        if (passwordErr !== '') {
            this.setState({
                error: passwordErr
            });
            return;
        }

        const confirmPassword = ReactDOM.findDOMNode(this.refs.passwordconfirm).value;
        if (!confirmPassword || password !== confirmPassword) {
            state.error = Utils.localizeMessage('claim.oauth_to_email.pwdNotMatch', 'Password do not match.');
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        Client.oauthToEmail(
            this.props.email,
            password,
            (data) => {
                if (data.follow_link) {
                    browserHistory.push(data.follow_link);
                }
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        const uiType = `${(this.props.currentType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : Utils.toTitleCase(this.props.currentType))} SSO`;

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.oauth_to_email.title'
                        defaultMessage='Switch {type} Account to Email'
                        values={{
                            type: uiType
                        }}
                    />
                </h3>
                <form onSubmit={this.submit}>
                    <p>
                        <FormattedMessage
                            id='claim.oauth_to_email.description'
                            defaultMessage='Upon changing your account type, you will only be able to login with your email and password.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.oauth_to_email.enterNewPwd'
                            defaultMessage='Enter a new password for your {site} email account'
                            values={{
                                site: global.window.mm_config.SiteName
                            }}
                        />
                    </p>
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder={Utils.localizeMessage('claim.oauth_to_email.newPwd', 'New Password')}
                            spellCheck='false'
                        />
                    </div>
                    <div className={formClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='passwordconfirm'
                            ref='passwordconfirm'
                            placeholder={Utils.localizeMessage('claim.oauth_to_email.confirm', 'Confirm Password')}
                            spellCheck='false'
                        />
                    </div>
                    {error}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.oauth_to_email.switchTo'
                            defaultMessage='Switch {type} to email and password'
                            values={{
                                type: uiType
                            }}
                        />
                    </button>
                </form>
            </div>
        );
    }
}

OAuthToEmail.defaultProps = {
};
OAuthToEmail.propTypes = {
    currentType: React.PropTypes.string,
    email: React.PropTypes.string
};
