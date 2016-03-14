// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import {browserHistory} from 'react-router';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

var holders = defineMessages({
    badTeam: {
        id: 'login_email.badTeam',
        defaultMessage: 'Bad team name'
    },
    emailReq: {
        id: 'login_email.emailReq',
        defaultMessage: 'An email is required'
    },
    pwdReq: {
        id: 'login_email.pwdReq',
        defaultMessage: 'A password is required'
    },
    email: {
        id: 'login_email.email',
        defaultMessage: 'Email'
    },
    pwd: {
        id: 'login_email.pwd',
        defaultMessage: 'Password'
    }
});

class LoginEmail extends React.Component {
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

        const email = this.refs.email.value.trim();
        if (!email) {
            state.serverError = formatMessage(holders.emailReq);
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

        Client.loginByEmail(name, email, password,
            () => {
                UserStore.setLastEmail(email);
                browserHistory.push('/' + name + '/channels/town-square');
            },
            (err) => {
                if (err.id === 'api.user.login.not_verified.app_error') {
                    window.location.href = '/verify_email?teamname=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.serverError = err.message;
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

        let priorEmail = UserStore.getLastEmail();
        let focusEmail = false;
        let focusPassword = false;
        if (priorEmail === '') {
            focusEmail = true;
        } else {
            focusPassword = true;
        }

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
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
                            autoFocus={focusEmail}
                            type='email'
                            className='form-control'
                            name='email'
                            defaultValue={priorEmail}
                            ref='email'
                            placeholder={formatMessage(holders.email)}
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
                                id='login_email.signin'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }
}
LoginEmail.defaultProps = {
};

LoginEmail.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string.isRequired
};

export default injectIntl(LoginEmail);
