// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import UserStore from '../stores/user_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import Constants from '../utils/constants.jsx';
import LoadingScreen from '../components/loading_screen.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'mm-intl';
import {browserHistory} from 'react-router';

class SignupUserComplete extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.inviteInfoRecieved = this.inviteInfoRecieved.bind(this);

        this.state = {
            data: '',
            hash: '',
            usedBefore: false,
            email: '',
            teamDisplayName: '',
            teamName: '',
            teamId: ''
        };
    }
    componentWillMount() {
        let data = this.props.location.query.d;
        let hash = this.props.location.query.h;
        const inviteId = this.props.location.query.id;
        let usedBefore = false;
        let email = '';
        let teamDisplayName = '';
        let teamName = '';
        let teamId = '';

        // If we have a hash in the url then we are attempting to access a private team
        if (hash) {
            const parsedData = JSON.parse(data);
            usedBefore = BrowserStore.getGlobalItem(hash);
            email = parsedData.email;
            teamDisplayName = parsedData.display_name;
            teamName = parsedData.name;
            teamId = parsedData.id;
        } else {
            Client.getInviteInfo(this.inviteInfoRecieved, null, inviteId);
            data = '';
            hash = '';
        }

        this.setState({
            data,
            hash,
            usedBefore,
            email,
            teamDisplayName,
            teamName,
            teamId
        });
    }
    inviteInfoRecieved(data) {
        if (!data) {
            return;
        }

        this.setState({
            teamDisplayName: data.display_name,
            teamName: data.name,
            teamId: data.id
        });
    }
    handleSubmit(e) {
        e.preventDefault();

        const providedEmail = ReactDOM.findDOMNode(this.refs.email).value.trim();
        if (!providedEmail) {
            this.setState({
                nameError: '',
                emailError: (<FormattedMessage id='signup_user_completed.required'/>),
                passwordError: '',
                serverError: ''
            });
            return;
        }

        if (!Utils.isEmail(providedEmail)) {
            this.setState({
                nameError: '',
                emailError: (<FormattedMessage id='signup_user_completed.validEmail'/>),
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const providedUsername = ReactDOM.findDOMNode(this.refs.name).value.trim().toLowerCase();
        if (!providedUsername) {
            this.setState({
                nameError: (<FormattedMessage id='signup_user_completed.required'/>),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const usernameError = Utils.isValidUsername(providedUsername);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({
                nameError: (<FormattedMessage id='signup_user_completed.reserved'/>),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        } else if (usernameError) {
            this.setState({
                nameError: (
                    <FormattedMessage
                        id='signup_user_completed.usernameLength'
                        min={Constants.MIN_USERNAME_LENGTH}
                        max={Constants.MAX_USERNAME_LENGTH}
                    />
                ),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const providedPassword = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!providedPassword || providedPassword.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({
                nameError: '',
                emailError: '',
                passwordError: (
                    <FormattedMessage
                        id='signup_user_completed.passwordLength'
                        min={Constants.MIN_PASSWORD_LENGTH}
                    />
                ),
                serverError: ''
            });
            return;
        }

        this.setState({
            nameError: '',
            emailError: '',
            passwordError: '',
            serverError: ''
        });

        const user = {
            team_id: this.state.teamId,
            email: providedEmail,
            username: providedUsername,
            password: providedPassword,
            allow_marketing: true
        };

        Client.createUser(user, this.state.data, this.state.hash,
            () => {
                Client.track('signup', 'signup_user_02_complete');

                Client.loginByEmail(this.state.teamName, user.email, user.password,
                    () => {
                        UserStore.setLastEmail(user.email);
                        if (this.state.hash > 0) {
                            BrowserStore.setGlobalItem(this.state.hash, JSON.stringify({usedBefore: true}));
                        }
                        browserHistory.push('/' + this.state.teamName + '/channels/town-square');
                    },
                    (err) => {
                        if (err.id === 'api.user.login.not_verified.app_error') {
                            browserHistory.push('/should_verify_email?email=' + encodeURIComponent(user.email) + '&teamname=' + encodeURIComponent(this.state.teamName));
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
        Client.track('signup', 'signup_user_01_welcome');

        // If we have been used then just display a message
        if (this.state.usedBefore) {
            return (
                <div>
                    <FormattedMessage
                        id='signup_user_completed.expired'
                        defaultMessage="You've already completed the signup process for this invitation or this invitation has expired."
                    />
                </div>
            );
        }

        // If we haven't got a team id yet we are waiting for
        // the client so just show the standard loading screen
        if (this.state.teamId === '') {
            return (<LoadingScreen/>);
        }

        // set up error labels
        var emailError = null;
        var emailHelpText = (
            <span className='help-block'>
                <FormattedMessage
                    id='signup_user_completed.emailHelp'
                    defaultMessage='Valid email required for sign-up'
                />
            </span>
        );
        var emailDivStyle = 'form-group';
        if (this.state.emailError) {
            emailError = (<label className='control-label'>{this.state.emailError}</label>);
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
        if (this.state.email) {
            yourEmailIs = (
                <FormattedHTMLMessage
                    id='signup_user_completed.emailIs'
                    defaultMessage="Your email address is <strong>{email}</strong>. You'll use this address to sign in to {siteName}."
                    values={{
                        email: this.state.email,
                        siteName: global.window.mm_config.SiteName
                    }}
                />
            );
        }

        var emailContainerStyle = 'margin--extra';
        if (this.state.email) {
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
                        defaultValue={this.state.email}
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
                    href={'/api/v1/oauth/gitlab/signup' + window.location.search + '&team=' + encodeURIComponent(this.state.teamName)}
                >
                    <span className='icon'/>
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
                    href={'/api/v1/oauth/google/signup' + window.location.search + '&team=' + encodeURIComponent(this.state.teamName)}
                >
                    <span className='icon'/>
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
                                    maxLength={Constants.MAX_USERNAME_LENGTH}
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
                        <FormattedMessage
                            id='signup_user_completed.or'
                            defaultMessage='or'
                        />
                    </div>
                </div>
            );
        }

        if (signupMessage.length === 0 && !emailSignup) {
            emailSignup = (
                <div>
                    <FormattedMessage
                        id='signup_user_completed.none'
                        defaultMessage='No user creation method has been enabled.  Please contact an administrator for access.'
                    />
                </div>
            );
        }

        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span classNameNameName='fa fa-chevron-left'/>
                        <FormattedMessage id='web.header.back'/>
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container padding--less'>
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
                            <h2 className='signup-team__name'>{this.state.teamName}</h2>
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
                </div>
            </div>
        );
    }
}

SignupUserComplete.defaultProps = {
};
SignupUserComplete.propTypes = {
    location: React.PropTypes.object
};

export default SignupUserComplete;
