// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginMfa from 'components/login/components/login_mfa.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {checkMfa} from 'actions/user_actions.jsx';
import {emailToOAuth} from 'actions/admin_actions.jsx';

import PropTypes from 'prop-types';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

export default class EmailToOAuth extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);
        this.preSubmit = this.preSubmit.bind(this);

        this.state = {showMfa: false, password: ''};
    }

    preSubmit(e) {
        e.preventDefault();
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value;
        if (!password) {
            state.error = Utils.localizeMessage('claim.email_to_oauth.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        this.setState({password});

        state.error = null;
        this.setState(state);

        checkMfa(
            this.props.email,
            (requiresMfa) => {
                if (requiresMfa) {
                    this.setState({showMfa: true});
                } else {
                    this.submit(this.props.email, password, '');
                }
            },
            (err) => {
                this.setState({error: err.message});
            }
        );
    }

    submit(loginId, password, token) {
        emailToOAuth(
            loginId,
            password,
            token,
            this.props.newType,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (err) => {
                this.setState({error: err.message, showMfa: false});
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

        const type = (this.props.newType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : Utils.toTitleCase(this.props.newType));
        const uiType = `${type} SSO`;

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
                <form onSubmit={this.preSubmit}>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_oauth.ssoType'
                            defaultMessage='Upon claiming your account, you will only be able to login with {type} SSO'
                            values={{
                                type
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_oauth.ssoNote'
                            defaultMessage='You must already have a valid {type} account'
                            values={{
                                type
                            }}
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='claim.email_to_oauth.enterPwd'
                            defaultMessage='Enter the password for your {site} account'
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
                            placeholder={Utils.localizeMessage('claim.email_to_oauth.pwd', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    {error}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='claim.email_to_oauth.switchTo'
                            defaultMessage='Switch account to {uiType}'
                            values={{
                                uiType
                            }}
                        />
                    </button>
                </form>
            );
        }

        return (
            <div>
                <h3>
                    <FormattedMessage
                        id='claim.email_to_oauth.title'
                        defaultMessage='Switch Email/Password Account to {uiType}'
                        values={{
                            uiType
                        }}
                    />
                </h3>
                {content}
            </div>
        );
    }
}

EmailToOAuth.defaultProps = {
};
EmailToOAuth.propTypes = {
    newType: PropTypes.string,
    email: PropTypes.string
};
