// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';

const messages = defineMessages({
    emailError1: {
        id: 'signup_user_completed.emailError1',
        defaultMessage: 'This field is required'
    },
    emailError2: {
        id: 'signup_user_completed.emailError2',
        defaultMessage: 'Please enter a valid email address'
    },
    nameError1: {
        id: 'signup_user_completed.nameError1',
        defaultMessage: 'This field is required'
    },
    nameError2: {
        id: 'signup_user_completed.nameError2',
        defaultMessage: 'This username is reserved, please choose a new one.'
    },
    nameError3: {
        id: 'signup_user_completed.nameError3',
        defaultMessage: 'Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols \'.\', \'-\' and \'_\'.'
    },
    passwordError: {
        id: 'signup_user_completed.passwordError',
        defaultMessage: 'Please enter at least 5 characters'
    },
    verifiedError: {
        id: 'signup_user_completed.verifiedError',
        defaultMessage: 'Login failed because email address has not been verified'
    },
    expired: {
        id: 'signup_user_completed.expired',
        defaultMessage: "You've already completed the signup process for this invitation or this invitation has expired."
    },
    emailIs: {
        id: 'signup_user_completed.emailIs',
        defaultMessage: 'Your email address is'
    },
    useToSign: {
        id: 'signup_user_completed.useToSign',
        defaultMessage: "You'll use this address to sign in to"
    },
    whatis: {
        id: 'signup_user_completed.whatis',
        defaultMessage: "What's your email address?"
    },
    zbox: {
        id: 'signup_user_completed.zbox',
        defaultMessage: 'With ZBox'
    },
    chooseUser: {
        id: 'signup_user_completed.chooseUser',
        defaultMessage: 'Choose your username'
    },
    userHelp: {
        id: 'signup_user_completed.userHelp',
        defaultMessage: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'"
    },
    choosePwd: {
        id: 'signup_user_completed.choosePwd',
        defaultMessage: 'Choose your password'
    },
    create: {
        id: 'signup_user_completed.create',
        defaultMessage: 'Create Account'
    },
    or: {
        id: 'signup_user_completed.or',
        defaultMessage: 'or'
    },
    welcome: {
        id: 'signup_user_completed.welcome',
        defaultMessage: 'Welcome to:'
    },
    on: {
        id: 'signup_user_completed.on',
        defaultMessage: 'on'
    },
    lets: {
        id: 'signup_user_completed.lets',
        defaultMessage: "Let's create your account"
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
            this.setState({nameError: '', emailError: formatMessage(messages.emailError1), passwordError: ''});
            return;
        }

        if (!Utils.isEmail(providedEmail)) {
            this.setState({nameError: '', emailError: formatMessage(messages.emailError2), passwordError: ''});
            return;
        }

        const providedUsername = ReactDOM.findDOMNode(this.refs.name).value.trim().toLowerCase();
        if (!providedUsername) {
            this.setState({nameError: formatMessage(messages.nameError1), emailError: '', passwordError: '', serverError: ''});
            return;
        }

        const usernameError = Utils.isValidUsername(providedUsername);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({nameError: formatMessage(messages.nameError2), emailError: '', passwordError: '', serverError: ''});
            return;
        } else if (usernameError) {
            this.setState({
                nameError: formatMessage(messages.nameError3),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const providedPassword = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!providedPassword || providedPassword.length < 5) {
            this.setState({nameError: '', emailError: '', passwordError: formatMessage(messages.passwordError), serverError: ''});
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
                        window.location.href = '/' + this.props.teamName + '/channels/general';
                    },
                    (err) => {
                        if (err.message === formatMessage(messages.verifiedError)) {
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
        const {formatMessage} = this.props.intl;
        client.track('signup', 'signup_user_01_welcome');

        if (this.state.wizard === 'finished') {
            return <div>{formatMessage(messages.expired)}</div>;
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
            yourEmailIs = <span>{formatMessage(messages.emailIs)} <strong>{this.state.user.email}</strong>. {formatMessage(messages.useToSign)} {global.window.mm_config.SiteName}.</span>;
        }

        var emailContainerStyle = 'margin--extra';
        if (this.state.original_email) {
            emailContainerStyle = 'hidden';
        }

        var email = (
            <div className={emailContainerStyle}>
                <h5><strong>{formatMessage(messages.whatis)}</strong></h5>
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
                </div>
            </div>
        );

        var signupMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
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

        if (global.window.mm_config.EnableSignUpWithZBox === 'true') {
            signupMessage.push(
                <a
                    className='btn btn-custom-login zbox'
                    href={'/' + this.props.teamName + '/signup/zbox' + window.location.search}
                >
                    <span className='icon' />
                    <span>{formatMessage(messages.zbox)}</span>
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
                            <h5><strong>{formatMessage(messages.chooseUser)}</strong></h5>
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
                                <span className='help-block'>{formatMessage(messages.userHelp)}</span>
                            </div>
                        </div>
                        <div className='margin--extra'>
                            <h5><strong>{formatMessage(messages.choosePwd)}</strong></h5>
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
                            {formatMessage(messages.create)}
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
                        <span>{formatMessage(messages.or)}</span>
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
                    <h5 className='margin--less'>{formatMessage(messages.welcome)}</h5>
                    <h2 className='signup-team__name'>{this.props.teamDisplayName}</h2>
                    <h2 className='signup-team__subdomain'>{formatMessage(messages.on)} {global.window.mm_config.SiteName}</h2>
                    <h4 className='color--light'>{formatMessage(messages.lets)}</h4>
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