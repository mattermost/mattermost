// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Utils = require('../utils/utils.jsx');
const Client = require('../utils/client.jsx');
const UserStore = require('../stores/user_store.jsx');
const BrowserStore = require('../stores/browser_store.jsx');

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {};
    }
    handleSubmit(e) {
        e.preventDefault();
        var state = {};

        const name = this.props.teamName;
        if (!name) {
            state.serverError = 'Bad team name';
            this.setState(state);
            return;
        }

        const email = ReactDOM.findDOMNode(this.refs.email).value.trim();
        if (!email) {
            state.serverError = 'An email is required';
            this.setState(state);
            return;
        }

        const password = ReactDOM.findDOMNode(this.refs.password).value.trim();
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

        Client.loginByEmail(name, email, password,
            () => {
                UserStore.setLastEmail(email);

                const redirect = Utils.getUrlParameter('redirect');
                if (redirect) {
                    window.location.href = decodeURIComponent(redirect);
                } else {
                    window.location.href = '/' + name + '/channels/town-square';
                }
            },
            (err) => {
                if (err.message === 'Login failed because email address has not been verified') {
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
                    >
                        <span className='icon' />
                        <span>{'with GitLab'}</span>
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
                    {' Email Verified'}
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
                            placeholder='Email'
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
                            placeholder='Password'
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {'Sign in'}
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
                        <span>{'or'}</span>
                    </div>
                </div>
            );
        }

        let forgotPassword;
        if (emailSignup) {
            forgotPassword = (
                <div className='form-group'>
                    <a href={'/' + teamName + '/reset_password'}>{'I forgot my password'}</a>
                </div>
            );
        }

        let userSignUp = null;
        if (this.props.inviteId) {
            userSignUp = (
                <div>
                    <span>{`Don't have an account? `}
                        <a
                            href={'/signup_user_complete/?id=' + this.props.inviteId}
                            className='signup-team-login'
                        >
                            {'Create one now'}
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
                        {'Create a new team'}
                    </a>
                </div>
            );
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>{'Sign in to:'}</h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>{'on '}{global.window.mm_config.SiteName}</h2>
                <form onSubmit={this.handleSubmit}>
                    {verifiedBox}
                    <div className={'form-group' + errorClass}>
                        {serverError}
                    </div>
                    {loginMessage}
                    {emailSignup}
                    {userSignUp}
                    <div className='form-group margin--extra form-group--small'>
                        <span><a href='/find_team'>{'Find your other teams'}</a></span>
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
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    inviteId: React.PropTypes.string
};
