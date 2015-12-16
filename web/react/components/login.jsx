// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';

const messages = defineMessages({
    badTeam: {
        id: 'login.badTeam',
        defaultMessage: 'Bad team name'
    },
    emailRequired: {
        id: 'login.emailRequired',
        defaultMessage: 'An email is required'
    },
    passwordRequired: {
        id: 'login.passwordRequired',
        defaultMessage: 'A password is required'
    },
    localStorage: {
        id: 'login.localStorage',
        defaultMessage: 'This service requires local storage to be enabled. Please enable it or exit private browsing.'
    },
    notVerified: {
        id: 'login.notVerified',
        defaultMessage: 'Login failed because email address has not been verified'
    },
    zbox: {
        id: 'login.zbox',
        defaultMessage: 'With ZBox'
    },
    email: {
        id: 'login.email',
        defaultMessage: 'Email'
    },
    password: {
        id: 'login.password',
        defaultMessage: 'Password'
    },
    singIn: {
        id: 'login.singIn',
        defaultMessage: 'Sign in'
    },
    or: {
        id: 'login.or',
        defaultMessage: 'or'
    },
    signTo: {
        id: 'login.signTo',
        defaultMessage: 'Sign in to:'
    },
    on: {
        id: 'login.on',
        defaultMessage: 'on '
    },
    verified: {
        id: 'login.verified',
        defaultMessage: ' Email Verified'
    },
    forgot: {
        id: 'login.forgot',
        defaultMessage: 'I forgot my password'
    },
    noAccount: {
        id: 'login.noAccount',
        defaultMessage: 'Don\'t have an account? '
    },
    create: {
        id: 'login.create',
        defaultMessage: 'Create one now'
    },
    createTeam: {
        id: 'login.createTeam',
        defaultMessage: 'Create a new team'
    },
    find: {
        id: 'login.find',
        defaultMessage: 'Find your other teams'
    }
});

class Login extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {};
    }
    handleSubmit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var state = {};

        const name = this.props.teamName;
        if (!name) {
            state.serverError = formatMessage(messages.badTeam);
            this.setState(state);
            return;
        }

        const email = ReactDOM.findDOMNode(this.refs.email).value.trim();
        if (!email) {
            state.serverError = formatMessage(messages.emailRequired);
            this.setState(state);
            return;
        }

        const password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.serverError = formatMessage(messages.passwordRequired);
            this.setState(state);
            return;
        }

        if (!BrowserStore.isLocalStorageSupported()) {
            state.serverError = formatMessage(messages.localStorage);
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        Client.loginByEmail(name, email, password,
            () => {
                UserStore.setLastEmail(email);

                const redirect = Utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + name + '/channels/general';
                }
            },
            (err) => {
                if (err.message === formatMessage(messages.notVerified)) {
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
        const {formatMessage} = this.props.intl;
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
        }
        let priorEmail = UserStore.getLastEmail();

        const emailParam = Utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        const teamDisplayName = this.props.teamDisplayName;
        const teamName = this.props.teamName;

        let focusEmail = false;
        let focusPassword = false;
        if (priorEmail === '') {
            focusEmail = true;
        } else {
            focusPassword = true;
        }

        let loginMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        href={'/' + teamName + '/login/gitlab'}
                        key='gitlab'
                    >
                        <span className='icon' />
                        <span>{'with GitLab'}</span>
                    </a>
           );
        }

        if (global.window.mm_config.EnableSignUpWithZBox === 'true') {
            loginMessage.push(
                <a
                    className='btn btn-custom-login zbox'
                    href={'/login/zbox'}
                >
                    <span className='icon' />
                    <span>{formatMessage(messages.zbox)}</span>
                </a>
            );
        }

        let errorClass = '';
        if (serverError) {
            errorClass = ' has-error';
        }

        const verifiedParam = Utils.getUrlParameter('verified');
        let verifiedBox = '';
        if (verifiedParam) {
            verifiedBox = (
                <div className='alert alert-success'>
                    <i className='fa fa-check' />
                    {formatMessage(messages.verified)}
                </div>
            );
        }

        let emailSignup;
        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            emailSignup = (
                <div className='signup__email-container'>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusEmail}
                            type='email'
                            className='form-control'
                            name='email'
                            defaultValue={priorEmail}
                            ref='email'
                            placeholder={formatMessage(messages.email)}
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
                            placeholder={formatMessage(messages.password)}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {formatMessage(messages.singIn)}
                        </button>
                    </div>
                </div>
            );
        }

        if (loginMessage.length > 0 && emailSignup) {
            loginMessage = (
                <div>
                    {loginMessage}
                    <div className='or__container'>
                        <span>{formatMessage(messages.or)}</span>
                    </div>
                </div>
            );
        }

        let forgotPassword;
        if (emailSignup) {
            forgotPassword = (
                <div className='form-group'>
                    <a href={'/' + teamName + '/reset_password'}>{formatMessage(messages.forgot)}</a>
                </div>
            );
        }

        let userSignUp = null;
        if (this.props.inviteId) {
            userSignUp = (
                <div>
                    <span>{formatMessage(messages.noAccount)}
                        <a
                            href={'/signup_user_complete/?id=' + this.props.inviteId}
                            className='signup-team-login'
                        >
                            {formatMessage(messages.create)}
                        </a>
                    </span>
                </div>
            );
        }

        let teamSignUp = null;
        if (global.window.mm_config.EnableTeamCreation === 'true') {
            teamSignUp = (
                <div className='margin--extra'>
                    <a
                        href='/'
                        className='signup-team-login'
                    >
                        {formatMessage(messages.createTeam)}
                    </a>
                </div>
            );
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>{formatMessage(messages.signTo)}</h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>{formatMessage(messages.on) + global.window.mm_config.SiteName}</h2>
                <form onSubmit={this.handleSubmit}>
                    {verifiedBox}
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    {loginMessage}
                    {emailSignup}
                    {userSignUp}
                    <div className='form-group margin--extra form-group--small'>
                        <span><a href='/find_team'>{formatMessage(messages.find)}</a></span>
                    </div>
                    {forgotPassword}
                    {teamSignUp}
                </form>
            </div>
        );
    }
}

Login.defaultProps = {
    teamName: '',
    teamDisplayName: ''
};
Login.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    inviteId: React.PropTypes.string
};

export default injectIntl(Login);