// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Constants = require('../utils/constants.jsx');

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {};
    }
    handleSubmit(e) {
        e.preventDefault();
        var state = {};

        var name = this.props.teamName;
        if (!name) {
            state.serverError = 'Bad team name';
            this.setState(state);
            return;
        }

        var email = this.refs.email.getDOMNode().value.trim();
        if (!email) {
            state.serverError = 'An email is required';
            this.setState(state);
            return;
        }

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password) {
            state.serverError = 'A password is required';
            this.setState(state);
            return;
        }

        if (!BrowserStore.isLocalStorageSupported()) {
            state.serverError = 'This service requires local storage to be enabled. Please enable it or exit private browsing.';
            this.setState(state);
            return;
        }

        state.serverError = '';
        this.setState(state);

        client.loginByEmail(name, email, password,
            function loggedIn(data) {
                UserStore.setCurrentUser(data);
                UserStore.setLastEmail(email);

                var redirect = utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + name + '/channels/town-square';
                }
            },
            function loginFailed(err) {
                if (err.message === 'Login failed because email address has not been verified') {
                    window.location.href = '/verify_email?teamname=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email);
                    return;
                }
                state.serverError = err.message;
                this.valid = false;
                this.setState(state);
            }.bind(this)
        );
    }
    render() {
        var serverError;
        if (this.state.serverError) {
            serverError = <label className='control-label'>{this.state.serverError}</label>;
        }
        var priorEmail = UserStore.getLastEmail();

        var emailParam = utils.getUrlParameter('email');
        if (emailParam) {
            priorEmail = decodeURIComponent(emailParam);
        }

        var teamDisplayName = this.props.teamDisplayName;
        var teamName = this.props.teamName;

        var focusEmail = false;
        var focusPassword = false;
        if (priorEmail !== '') {
            focusPassword = true;
        } else {
            focusEmail = true;
        }

        var authServices = JSON.parse(this.props.authServices);

        var loginMessage = [];
        if (authServices.indexOf(Constants.GITLAB_SERVICE) !== -1) {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        href={'/' + teamName + '/login/gitlab'}
                    >
                        <span className='icon' />
                        <span>with GitLab</span>
                    </a>
           );
        }

        var errorClass = '';
        if (serverError) {
            errorClass = ' has-error';
        }

        var emailSignup;
        if (authServices.indexOf(Constants.EMAIL_SERVICE) !== -1) {
            emailSignup = (
                <div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusEmail}
                            type='email'
                            className='form-control'
                            name='email'
                            defaultValue={priorEmail}
                            ref='email'
                            placeholder='Email'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            autoFocus={focusPassword}
                            type='password'
                            className='form-control'
                            name='password'
                            ref='password'
                            placeholder='Password'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            Sign in
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
                        <span>or</span>
                    </div>
                </div>
            );
        }

        var forgotPassword;
        if (emailSignup) {
            forgotPassword = (
                <div className='form-group'>
                    <a href={'/' + teamName + '/reset_password'}>I forgot my password</a>
                </div>
            );
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>Sign in to:</h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>on {config.SiteName}</h2>
                <form onSubmit={this.handleSubmit}>
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    {loginMessage}
                    {emailSignup}
                    <div className='form-group margin--extra form-group--small'>
                        <span><a href='/find_team'>{'Find other ' + strings.TeamPlural}</a></span>
                    </div>
                    {forgotPassword}
                    <div className='margin--extra'>
                        <span>{'Want to create your own ' + strings.Team + '? '}
                            <a
                                href='/'
                                className='signup-team-login'
                            >
                                Sign up now
                            </a>
                        </span>
                    </div>
                </form>
            </div>
        );
    }
}

Login.defaultProps = {
    teamName: '',
    teamDisplayName: '',
    authServices: ''
};
Login.propTypes = {
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    authServices: React.PropTypes.string
};
