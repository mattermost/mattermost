// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

var holders = defineMessages({
    badTeam: {
        id: 'login_username.badTeam',
        defaultMessage: 'Bad team name'
    },
    usernameReq: {
        id: 'login_username.usernameReq',
        defaultMessage: 'A username is required'
    },
    pwdReq: {
        id: 'login_username.pwdReq',
        defaultMessage: 'A password is required'
    },
    verifyEmailError: {
        id: 'login_username.verifyEmailError',
        defaultMessage: 'Please verify your email address. Check your inbox for an email.'
    },
    userNotFoundError: {
        id: 'login_username.userNotFoundError',
        defaultMessage: "We couldn't find an existing account matching your username for this team."
    },
    username: {
        id: 'login_username.username',
        defaultMessage: 'Username'
    },
    pwd: {
        id: 'login_username.pwd',
        defaultMessage: 'Password'
    }
});

export default class LoginUsername extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            serverError: ''
        };
    }
    handleSubmit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var state = {};

        const name = this.props.teamName;
        if (!name) {
            state.serverError = formatMessage(holders.badTeam);
            this.setState(state);
            return;
        }

        const username = this.refs.username.value.trim();
        if (!username) {
            state.serverError = formatMessage(holders.usernameReq);
            this.setState(state);
            return;
        }

        const password = this.refs.password.value.trim();
        if (!password) {
            state.serverError = formatMessage(holders.pwdReq);
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        Client.loginByUsername(name, username, password,
            () => {
                UserStore.setLastUsername(username);

                const redirect = Utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + name + '/channels/town-square';
                }
            },
            (err) => {
                if (err.id === 'api.user.login.not_verified.app_error') {
                    state.serverError = formatMessage(holders.verifyEmailError);
                } else if (err.id === 'store.sql_user.get_by_username.app_error') {
                    state.serverError = formatMessage(holders.userNotFoundError);
                } else {
                    state.serverError = err.message;
                }

                this.valid = false;
                this.setState(state);
            }
        );
    }
    render() {
        let serverError;
        let errorClass = '';
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
            errorClass = ' has-error';
        }

        let priorUsername = UserStore.getLastUsername();
        let focusUsername = false;
        let focusPassword = false;
        if (priorUsername === '') {
            focusUsername = true;
        } else {
            focusPassword = true;
        }

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorUsername = decodeURIComponent(emailParam);
        }

        const {formatMessage} = this.props.intl;
        return (
            <form onSubmit={this.handleSubmit}>
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusUsername}
                            type='username'
                            className='form-control'
                            name='username'
                            defaultValue={priorUsername}
                            ref='username'
                            placeholder={formatMessage(holders.username)}
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
                            placeholder={formatMessage(holders.pwd)}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='login_username.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginUsername.defaultProps = {
};

LoginUsername.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string.isRequired
};

export default injectIntl(LoginUsername);
