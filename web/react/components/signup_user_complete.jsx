// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var Constants = require('../utils/constants.jsx');

export default class SignupUserComplete extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);

        var initialState = BrowserStore.getGlobalItem(this.props.hash);

        if (!initialState) {
            initialState = {};
            initialState.wizard = 'welcome';
            initialState.user = {};
            initialState.user.team_id = this.props.teamId;
            initialState.user.email = this.props.email;
            initialState.hash = this.props.hash;
            initialState.data = this.props.data;
            initialState.original_email = this.props.email;
        }

        this.state = initialState;
    }
    handleSubmit(e) {
        e.preventDefault();

        this.state.user.username = this.refs.name.getDOMNode().value.trim();
        if (!this.state.user.username) {
            this.setState({nameError: 'This field is required', emailError: '', passwordError: '', serverError: ''});
            return;
        }

        var usernameError = utils.isValidUsername(this.state.user.username);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({nameError: 'This username is reserved, please choose a new one.', emailError: '', passwordError: '', serverError: ''});
            return;
        } else if (usernameError) {
            this.setState({
                nameError: 'Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\' and \'_\'.',
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        this.state.user.email = this.refs.email.getDOMNode().value.trim();
        if (!this.state.user.email) {
            this.setState({nameError: '', emailError: 'This field is required', passwordError: ''});
            return;
        }

        this.state.user.password = this.refs.password.getDOMNode().value.trim();
        if (!this.state.user.password || this.state.user.password .length < 5) {
            this.setState({nameError: '', emailError: '', passwordError: 'Please enter at least 5 characters', serverError: ''});
            return;
        }

        this.setState({nameError: '', emailError: '', passwordError: '', serverError: ''});

        this.state.user.allow_marketing = true;

        client.createUser(this.state.user, this.state.data, this.state.hash,
            function createUserSuccess() {
                client.track('signup', 'signup_user_02_complete');

                client.loginByEmail(this.props.teamName, this.state.user.email, this.state.user.password,
                    function emailLoginSuccess(data) {
                        UserStore.setLastEmail(this.state.user.email);
                        UserStore.setCurrentUser(data);
                        if (this.props.hash > 0) {
                            BrowserStore.setGlobalItem(this.props.hash, JSON.stringify({wizard: 'finished'}));
                        }
                        window.location.href = '/';
                    }.bind(this),
                    function emailLoginFailure(err) {
                        if (err.message === 'Login failed because email address has not been verified') {
                            window.location.href = '/verify_email?email=' + encodeURIComponent(this.state.user.email) + '&teamname=' + encodeURIComponent(this.props.teamName);
                        } else {
                            this.setState({serverError: err.message});
                        }
                    }.bind(this)
                );
            }.bind(this),
            function createUserFailure(err) {
                this.setState({serverError: err.message});
            }.bind(this)
        );
    }
    render() {
        client.track('signup', 'signup_user_01_welcome');

        if (this.state.wizard === 'finished') {
            return <div>You've already completed the signup process for this invitation or this invitation has expired.</div>;
        }

        // set up error labels
        var emailError = null;
        var emailDivStyle = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailDivStyle += ' has-error';
        }

        var nameError = null;
        var nameDivStyle = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivStyle += ' has-error';
        }

        var passwordError = null;
        var passwordDivStyle = 'form-group';
        if (this.state.passwordError) {
            passwordError = <label className='control-label'>{this.state.passwordError}</label>;
            passwordDivStyle += ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className={'form-group has-error'}>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        // set up the email entry and hide it if an email was provided
        var yourEmailIs = '';
        if (this.state.user.email) {
            yourEmailIs = <span>Your email address is {this.state.user.email}. You'll use this address to sign in to {config.SiteName}.</span>;
        }

        var emailContainerStyle = 'margin--extra';
        if (this.state.original_email) {
            emailContainerStyle = 'hidden';
        }

        var email = (
            <div className={emailContainerStyle}>
                <h5><strong>What's your email address?</strong></h5>
                <div className={emailDivStyle}>
                    <input
                        type='email'
                        ref='email'
                        className='form-control'
                        defaultValue={this.state.user.email}
                        placeholder=''
                        maxLength='128'
                        autoFocus={true}
                    />
                    {emailError}
                </div>
            </div>
        );

        // add options to log in using another service
        var authServices = JSON.parse(this.props.authServices);

        var signupMessage = [];
        if (authServices.indexOf(Constants.GITLAB_SERVICE) >= 0) {
            signupMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        href={'/' + this.props.teamName + '/signup/gitlab' + window.location.search}
                    >
                        <span className='icon' />
                        <span>with GitLab</span>
                    </a>
           );
        }

        var emailSignup;
        if (authServices.indexOf(Constants.EMAIL_SERVICE) !== -1) {
            emailSignup = (
                <div>
                    <div className='inner__content'>
                        {email}
                        {yourEmailIs}
                        <div className='margin--extra'>
                            <h5><strong>Choose your username</strong></h5>
                            <div className={nameDivStyle}>
                                <input
                                    type='text'
                                    ref='name'
                                    className='form-control'
                                    placeholder=''
                                    maxLength='128'
                                />
                                {nameError}
                                <p className='form__hint'>Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'</p>
                            </div>
                        </div>
                        <div className='margin--extra'>
                            <h5><strong>Choose your password</strong></h5>
                            <div className={passwordDivStyle}>
                            <input
                                type='password'
                                ref='password'
                                className='form-control'
                                placeholder=''
                                maxLength='128'
                            />
                            {passwordError}
                        </div>
                        </div>
                    </div>
                    <p className='margin--extra'>
                        <button
                            type='submit'
                            onClick={this.handleSubmit}
                            className='btn-primary btn'
                        >
                            Create Account
                        </button>
                    </p>
                </div>
            );
        }

        if (signupMessage.length > 0 && emailSignup) {
            signupMessage = (
                <div>
                    {signupMessage}
                    <div className='or__container'>
                        <span>or</span>
                    </div>
                </div>
            );
        }

        var termsDisclaimer = null;
        if (config.ShowTermsDuringSignup) {
            termsDisclaimer = <p>By creating an account and using Mattermost you are agreeing to our <a href={config.TermsLink}>Terms of Service</a>. If you do not agree, you cannot use this service.</p>;
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h5 className='margin--less'>Welcome to:</h5>
                    <h2 className='signup-team__name'>{this.props.teamDisplayName}</h2>
                    <h2 className='signup-team__subdomain'>on {config.SiteName}</h2>
                    <h4 className='color--light'>Let's create your account</h4>
                    {signupMessage}
                    {emailSignup}
                    {serverError}
                    {termsDisclaimer}
                </form>
            </div>
        );
    }
}

SignupUserComplete.defaultProps = {
    teamName: '',
    hash: '',
    teamId: '',
    email: '',
    data: null,
    authServices: '',
    teamDisplayName: ''
};
SignupUserComplete.propTypes = {
    teamName: React.PropTypes.string,
    hash: React.PropTypes.string,
    teamId: React.PropTypes.string,
    email: React.PropTypes.string,
    data: React.PropTypes.string,
    authServices: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};
