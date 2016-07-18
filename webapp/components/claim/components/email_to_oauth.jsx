// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

export default class EmailToOAuth extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        e.preventDefault();
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value;
        if (!password) {
            state.error = Utils.localizeMessage('claim.email_to_oauth.pwdError', 'Please enter your password.');
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        Client.emailToOAuth(
            this.props.email,
            password,
            this.props.newType,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
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

        const type = (this.props.newType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : Utils.toTitleCase(this.props.newType));
        const uiType = `${type} SSO`;

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
                <form onSubmit={this.submit}>
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
            </div>
        );
    }
}

EmailToOAuth.defaultProps = {
};
EmailToOAuth.propTypes = {
    newType: React.PropTypes.string,
    email: React.PropTypes.string
};
