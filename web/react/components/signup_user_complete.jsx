// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const holders = defineMessages({
    required: {
        id: 'signup_user_completed.required',
        defaultMessage: 'This field is required'
    },
    validEmail: {
        id: 'signup_user_completed.validEmail',
        defaultMessage: 'Please enter a valid email address'
    },
    reserved: {
        id: 'signup_user_completed.reserved',
        defaultMessage: 'This username is reserved, please choose a new one.'
    },
    usernameLength: {
        id: 'signup_user_completed.usernameLength',
        defaultMessage: 'Username must begin with a letter, and contain between {min} to {max} lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\' and \'_\'.'
    },
    passwordLength: {
        id: 'signup_user_completed.passwordLength',
        defaultMessage: 'Please enter at least {min} characters'
    }
});

class SignupUserComplete extends React.Component {
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
            initialState.original_email = this.props.email;
        }

        this.state = initialState;
    }
    handleSubmit(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        const providedEmail = ReactDOM.findDOMNode(this.refs.email).value.trim();
        if (!providedEmail) {
            this.setState({nameError: '', emailError: formatMessage(holders.required), passwordError: ''});
            return;
        }

        if (!Utils.isEmail(providedEmail)) {
            this.setState({nameError: '', emailError: formatMessage(holders.validEmail), passwordError: ''});
            return;
        }

        const providedUsername = ReactDOM.findDOMNode(this.refs.name).value.trim().toLowerCase();
        if (!providedUsername) {
            this.setState({nameError: formatMessage(holders.required), emailError: '', passwordError: '', serverError: ''});
            return;
        }

        const usernameError = Utils.isValidUsername(providedUsername);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({nameError: formatMessage(holders.reserved), emailError: '', passwordError: '', serverError: ''});
            return;
        } else if (usernameError) {
            this.setState({
                nameError: formatMessage(holders.usernameLength, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH}),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const providedPassword = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!providedPassword || providedPassword.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({nameError: '', emailError: '', passwordError: formatMessage(holders.passwordLength, {min: Constants.MIN_PASSWORD_LENGTH}), serverError: ''});
            return;
        }

        const user = {
            team_id: this.props.teamId,
            email: providedEmail,
            username: providedUsername,
            password: providedPassword,
            allow_marketing: true
        };

        this.setState({
            user,
            nameError: '',
            emailError: '',
            passwordError: '',
            serverError: ''
        });

        client.createUser(user, this.props.data, this.props.hash,
            () => {
                client.track('signup', 'signup_user_02_complete');

                client.loginByEmail(this.props.teamName, user.email, user.password,
                    () => {
                        UserStore.setLastEmail(user.email);
                        if (this.props.hash > 0) {
                            BrowserStore.setGlobalItem(this.props.hash, JSON.stringify({wizard: 'finished'}));
                        }
                        window.location.href = '/' + this.props.teamName + '/channels/town-square';
                    },
                    (err) => {
                        if (err.id === 'api.user.login.not_verified.app_error') {
                            window.location.href = '/verify_email?email=' + encodeURIComponent(user.email) + '&teamname=' + encodeURIComponent(this.props.teamName);
                        } else {
                            this.setState({serverError: err.message});
                        }
                    }
                );
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    render() {
        client.track('signup', 'signup_user_01_welcome');

        if (this.state.wizard === 'finished') {
            return (
                <div>
                    <FormattedMessage
                        id='signup_user_completed.expired'
                        defaultMessage="You've already completed the signup process for this invitation or this invitation has expired."
                    />
                </div>
            );
        }

        // set up error labels
        var emailError = null;
        var emailHelpText = (
            <span className='help-block'>
                <FormattedMessage
                    id='signup_user_completed.emailHelp'
                    defaultMessage="Valid email required for sign-up"
                    />
            </span>
        );
        var emailDivStyle = 'form-group';
        if (this.state.emailError) {
            emailError = <label className='control-label'>{this.state.emailError}</label>;
            emailHelpText = '';
            emailDivStyle += ' has-error';
        }

        var nameError = null;
        var nameHelpText = (
            <span className='help-block'>
                <FormattedMessage
                    id='signup_user_completed.userHelp'
                    defaultMessage="Username must begin with a letter, and contain between {min} to {max} lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'"
                    values={{
                        min: Constants.MIN_USERNAME_LENGTH,
                        max: Constants.MAX_USERNAME_LENGTH
                    }}
                />
            </span>
        );
        var nameDivStyle = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameHelpText = '';
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
            yourEmailIs = (
                <FormattedHTMLMessage
                    id='signup_user_completed.emailIs'
                    defaultMessage="Your email address is <strong>{email}</strong>. You'll use this address to sign in to {siteName}."
                    values={{
                        email: this.state.user.email,
                        siteName: global.window.mm_config.SiteName
                    }}
                />
            );
        }

        var emailContainerStyle = 'margin--extra';
        if (this.state.original_email) {
            emailContainerStyle = 'hidden';
        }

        var email = (
            <div className={emailContainerStyle}>
                <h5><strong>
                    <FormattedMessage
                        id='signup_user_completed.whatis'
                        defaultMessage="What's your email address?"
                    />
                </strong></h5>
                <div className={emailDivStyle}>
                    <input
                        type='email'
                        ref='email'
                        className='form-control'
                        defaultValue={this.state.user.email}
                        placeholder=''
                        maxLength='128'
                        autoFocus={true}
                        spellCheck='false'
                    />
                    {emailError}
                    {emailHelpText}
                </div>
            </div>
        );

        var signupMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            signupMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        key='gitlab'
                        href={'/' + this.props.teamName + '/signup/gitlab' + window.location.search}
                    >
                        <span className='icon' />
                        <span>
                            <FormattedMessage
                                id='signup_user_completed.gitlab'
                                defaultMessage='with GitLab'
                            />
                        </span>
                    </a>
           );
        }

        if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            signupMessage.push(
                <a
                    className='btn btn-custom-login google'
                    key='google'
                    href={'/' + this.props.teamName + '/signup/google' + window.location.search}
                >
                    <span className='icon' />
                    <span>
                        <FormattedMessage
                            id='signup_user_completed.google'
                            defaultMessage='with Google'
                        />
                    </span>
                </a>
           );
        }

        var emailSignup;
        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            emailSignup = (
                <div>
                    <div className='inner__content'>
                        {email}
                        {yourEmailIs}
                        <div className='margin--extra'>
                            <h5><strong>
                                <FormattedMessage
                                    id='signup_user_completed.chooseUser'
                                    defaultMessage='Choose your username'
                                />
                            </strong></h5>
                            <div className={nameDivStyle}>
                                <input
                                    type='text'
                                    ref='name'
                                    className='form-control'
                                    placeholder=''
                                    maxLength='128'
                                    spellCheck='false'
                                />
                                {nameError}
                                {nameHelpText}
                            </div>
                        </div>
                        <div className='margin--extra'>
                            <h5><strong>
                                <FormattedMessage
                                    id='signup_user_completed.choosePwd'
                                    defaultMessage='Choose your password'
                                />
                            </strong></h5>
                            <div className={passwordDivStyle}>
                            <input
                                type='password'
                                ref='password'
                                className='form-control'
                                placeholder=''
                                maxLength='128'
                                spellCheck='false'
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
                            <FormattedMessage
                                id='signup_user_completed.create'
                                defaultMessage='Create Account'
                            />
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
                        <span>
                            <FormattedMessage
                                id='signup_user_completed.or'
                                defaultMessage='or'
                            />
                        </span>
                    </div>
                </div>
            );
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h5 className='margin--less'>
                        <FormattedMessage
                            id='signup_user_completed.welcome'
                            defaultMessage='Welcome to:'
                        />
                    </h5>
                    <h2 className='signup-team__name'>{this.props.teamDisplayName}</h2>
                    <h2 className='signup-team__subdomain'>
                        <FormattedMessage
                            id='signup_user_completed.onSite'
                            defaultMessage='on {siteName}'
                            values={{
                                siteName: global.window.mm_config.SiteName
                            }}
                        />
                    </h2>
                    <h4 className='color--light'>
                        <FormattedMessage
                            id='signup_user_completed.lets'
                            defaultMessage="Let's create your account"
                        />
                    </h4>
                    {signupMessage}
                    {emailSignup}
                    {serverError}
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
    teamDisplayName: ''
};
SignupUserComplete.propTypes = {
    intl: intlShape.isRequired,
    teamName: React.PropTypes.string,
    hash: React.PropTypes.string,
    teamId: React.PropTypes.string,
    email: React.PropTypes.string,
    data: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string
};

export default injectIntl(SignupUserComplete);