// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FormError from 'components/form_error.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {track} from 'actions/analytics_actions.jsx';

import BrowserStore from 'stores/browser_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

import logoImage from 'images/logo.png';

export default class SignupUserComplete extends React.Component {
    static get propTypes() {
        return {
            location: React.PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleLdapSignup = this.handleLdapSignup.bind(this);

        this.handleLdapIdChange = this.handleLdapIdChange.bind(this);
        this.handleLdapPasswordChange = this.handleLdapPasswordChange.bind(this);

        this.state = {
            data: '',
            hash: '',
            usedBefore: false,
            email: '',
            teamDisplayName: '',
            signupDisabledError: '',
            teamName: '',
            teamId: '',
            openServer: false,
            loading: true,
            inviteId: '',
            ldapId: '',
            ldapPassword: ''
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
        let openServer = false;
        let loading = true;

        if ((inviteId && inviteId.length > 0) || (hash && hash.length > 0)) {
            // if we are already logged in then attempt to just join the team
            if (UserStore.getCurrentUser()) {
                loading = true;
                Client.addUserToTeamFromInvite(
                    data,
                    hash,
                    inviteId,
                    (team) => {
                        GlobalActions.emitInitialLoad(
                            () => {
                                browserHistory.push('/' + team.name);
                            }
                        );
                    },
                    (err) => {
                        this.setState({
                            noOpenServerError: true,
                            serverError: err.message,
                            loading: false
                        });
                    }
                );
            } else if (hash) {
                // If we have a hash in the url then we are attempting to access a private team
                const parsedData = JSON.parse(data);
                usedBefore = BrowserStore.getGlobalItem(hash);
                email = parsedData.email;
                teamDisplayName = parsedData.display_name;
                teamName = parsedData.name;
                teamId = parsedData.id;
                loading = false;
            } else {
                loading = true;
                Client.getInviteInfo(
                    inviteId,
                    (inviteData) => {
                        if (!inviteData) {
                            return;
                        }

                        this.setState({
                            serverError: null,
                            teamDisplayName: inviteData.display_name,
                            teamName: inviteData.name,
                            teamId: inviteData.id,
                            loading: false
                        });
                    },
                    () => {
                        this.setState({
                            noOpenServerError: true,
                            loading: false,
                            serverError:
                                <FormattedMessage
                                    id='signup_user_completed.invalid_invite'
                                    defaultMessage='The invite link was invalid.  Please speak with your Administrator to receive an invitation.'
                                />
                        });
                    }
                );

                data = '';
                hash = '';
            }
        } else if (global.window.mm_config.EnableOpenServer === 'true' || UserStore.getNoAccounts()) {
            // If this is the first account then let them create an account anyway.
            // The server will verify it's the first account before allowing creation.
            // Of if the server is open then we don't care.
            openServer = true;
            loading = false;
        } else {
            loading = false;
            this.setState({
                noOpenServerError: true,
                serverError:
                    <FormattedMessage
                        id='signup_user_completed.no_open_server'
                        defaultMessage='This server does not allow open signups.  Please speak with your Administrator to receive an invitation.'
                    />,
                loading: false
            });
        }

        this.setState({
            data,
            hash,
            usedBefore,
            email,
            teamDisplayName,
            teamName,
            teamId,
            openServer,
            inviteId,
            loading
        });

        this.setState({
            signupDisabledError: (
                <FormattedMessage
                    id='signup_user_completed.none'
                    defaultMessage='No user creation method has been enabled. Please contact an administrator for access.'
                />
            )
        });
    }

    handleLdapSignup(e) {
        e.preventDefault();

        this.setState({ldapError: ''});

        Client.webLoginByLdap(
            this.state.ldapId,
            this.state.ldapPassword,
            null,
            () => {
                if (this.props.location.query.id || this.props.location.query.h) {
                    Client.addUserToTeamFromInvite(
                        this.props.location.query.d,
                        this.props.location.query.h,
                        this.props.location.query.id,
                        () => {
                            this.finishSignup();
                        },
                        () => {
                            // there's not really a good way to deal with this, so just let the user log in like normal
                            this.finishSignup();
                        }
                    );

                    return;
                }

                this.finishSignup();
            },
            (err) => {
                if (err.id === 'ent.ldap.do_login.user_not_registered.app_error' || err.id === 'ent.ldap.do_login.user_filtered.app_error') {
                    this.setState({
                        ldapError: (
                            <FormattedMessage
                                id='login.userNotFound'
                                defaultMessage="We couldn't find an account matching your login credentials."
                            />
                        )
                    });
                } else if (err.id === 'ent.ldap.do_login.invalid_password.app_error') {
                    this.setState({
                        ldapError: (
                            <FormattedMessage
                                id='login.invalidPassword'
                                defaultMessage='Your password is incorrect.'
                            />
                        )
                    });
                } else {
                    this.setState({ldapError: err.message});
                }
            }
        );
    }

    finishSignup() {
        GlobalActions.emitInitialLoad(
            () => {
                const query = this.props.location.query;
                GlobalActions.loadDefaultLocale();
                if (query.redirect_to) {
                    browserHistory.push(query.redirect_to);
                } else {
                    browserHistory.push('/select_team');
                }
            }
        );
    }

    handleUserCreated(user, data) {
        track('signup', 'signup_user_02_complete');
        Client.loginById(
            data.id,
            user.password,
            '',
            () => {
                if (this.state.hash > 0) {
                    BrowserStore.setGlobalItem(this.state.hash, JSON.stringify({usedBefore: true}));
                }

                GlobalActions.emitInitialLoad(
                    () => {
                        const query = this.props.location.query;
                        if (query.redirect_to) {
                            browserHistory.push(query.redirect_to);
                        } else {
                            browserHistory.push('/select_team');
                        }
                    }
                );
            },
            (err) => {
                if (err.id === 'api.user.login.not_verified.app_error') {
                    browserHistory.push('/should_verify_email?email=' + encodeURIComponent(user.email) + '&teamname=' + encodeURIComponent(this.state.teamName));
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
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
                        values={{
                            min: Constants.MIN_USERNAME_LENGTH,
                            max: Constants.MAX_USERNAME_LENGTH
                        }}
                    />
                ),
                emailError: '',
                passwordError: '',
                serverError: ''
            });
            return;
        }

        const providedPassword = ReactDOM.findDOMNode(this.refs.password).value;
        const pwdError = Utils.isValidPassword(providedPassword);
        if (pwdError != null) {
            this.setState({
                nameError: '',
                emailError: '',
                passwordError: pwdError,
                serverError: ''
            });
        }

        this.setState({
            nameError: '',
            emailError: '',
            passwordError: '',
            serverError: ''
        });

        const user = {
            email: providedEmail,
            username: providedUsername,
            password: providedPassword,
            allow_marketing: true
        };

        Client.createUserWithInvite(user,
            this.state.data,
            this.state.hash,
            this.state.inviteId,
            this.handleUserCreated.bind(this, user),
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    handleLdapIdChange(e) {
        e.preventDefault();

        this.setState({
            ldapId: e.target.value
        });
    }

    handleLdapPasswordChange(e) {
        e.preventDefault();

        this.setState({
            ldapPassword: e.target.value
        });
    }

    renderLdapLogin() {
        let ldapIdPlaceholder;
        if (global.window.mm_config.LdapLoginFieldName) {
            ldapIdPlaceholder = global.window.mm_config.LdapLoginFieldName;
        } else {
            ldapIdPlaceholder = Utils.localizeMessage('login.ldap_username', 'LDAP Username');
        }

        let errorClass = '';
        if (this.state.ldapError) {
            errorClass += ' has-error';
        }

        return (
            <form
                onSubmit={this.handleLdapSignup}
            >
                <div className='signup__email-container'>
                    <FormError
                        error={this.state.ldapError}
                        margin={true}
                    />
                    <div className={'form-group' + errorClass}>
                        <input
                            className='form-control'
                            name='ldapId'
                            value={this.state.ldapId}
                            onChange={this.handleLdapIdChange}
                            placeholder={ldapIdPlaceholder}
                            spellCheck='false'
                            autoCapitalize='off'
                        />
                    </div>
                    <div className={'form-group' + errorClass}>
                        <input
                            type='password'
                            className='form-control'
                            name='password'
                            value={this.state.ldapPassword}
                            onChange={this.handleLdapPasswordChange}
                            placeholder={Utils.localizeMessage('login.password', 'Password')}
                            spellCheck='false'
                        />
                    </div>
                    <div className='form-group'>
                        <button
                            type='submit'
                            className='btn btn-primary'
                            disabled={!this.state.ldapId || !this.state.ldapPassword}
                        >
                            <FormattedMessage
                                id='login.signIn'
                                defaultMessage='Sign in'
                            />
                        </button>
                    </div>
                </div>
            </form>
        );
    }

    render() {
        track('signup', 'signup_user_01_welcome');

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

        if (this.state.loading) {
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
                        autoCapitalize='off'
                    />
                    {emailError}
                    {emailHelpText}
                </div>
            </div>
        );

        let signupMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            signupMessage.push(
                <a
                    className='btn btn-custom-login gitlab'
                    key='gitlab'
                    href={Client.getOAuthRoute() + '/gitlab/signup' + window.location.search}
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
                    href={Client.getOAuthRoute() + '/google/signup' + window.location.search + '&team=' + encodeURIComponent(this.state.teamName)}
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

        if (global.window.mm_config.EnableSaml === 'true' && global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.SAML === 'true') {
            signupMessage.push(
                <a
                    className='btn btn-custom-login saml'
                    key='saml'
                    href={`/login/sso/saml${window.location.search}${window.location.search ? '&' : '?'}action=signup`}
                >
                    <span>
                        {global.window.mm_config.SamlLoginButtonText}
                    </span>
                </a>
            );
        }

        let ldapSignup;
        if (global.window.mm_config.EnableLdap === 'true' && global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP) {
            ldapSignup = (
                <div className='inner__content'>
                    <h5>
                        <strong>
                            <FormattedMessage
                                id='signup_user_completed.withLdap'
                                defaultMessage='With your LDAP credentials'
                            />
                        </strong>
                    </h5>
                    {this.renderLdapLogin()}
                </div>
            );
        }

        let emailSignup;
        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            emailSignup = (
                <form>
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
                                    autoCapitalize='off'
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
                </form>
            );
        }

        if (signupMessage.length > 0 && (emailSignup || ldapSignup)) {
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

        if (ldapSignup && emailSignup) {
            ldapSignup = (
                <div>
                    {ldapSignup}
                    <div className='or__container'>
                        <FormattedMessage
                            id='signup_user_completed.or'
                            defaultMessage='or'
                        />
                    </div>
                </div>
            );
        }

        let terms = null;
        if (!this.state.noOpenServerError && (emailSignup || ldapSignup)) {
            terms = (
                <p>
                    <FormattedHTMLMessage
                        id='create_team.agreement'
                        defaultMessage="By proceeding to create your account and use {siteName}, you agree to our <a href='/static/help/terms.html'>Terms of Service</a> and <a href='/static/help/privacy.html'>Privacy Policy</a>. If you do not agree, you cannot use {siteName}."
                        values={{
                            siteName: global.window.mm_config.SiteName
                        }}
                    />
                </p>
            );
        }

        if (signupMessage.length === 0 && !emailSignup && !ldapSignup) {
            emailSignup = (
                <FormError
                    error={this.state.signupDisabledError}
                    margin={true}
                />
            );
        }

        if (this.state.noOpenServerError) {
            signupMessage = null;
            emailSignup = null;
            ldapSignup = null;
        }

        return (
            <div>
                <div className='signup-header'>
                    <Link to='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container padding--less'>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <h1>{global.window.mm_config.SiteName}</h1>
                        <h4 className='color--light'>
                            <FormattedMessage
                                id='web.root.singup_info'
                            />
                        </h4>
                        <h4 className='color--light'>
                            <FormattedMessage
                                id='signup_user_completed.lets'
                                defaultMessage="Let's create your account"
                            />
                        </h4>
                        <span className='color--light'>
                            <FormattedMessage
                                id='signup_user_completed.haveAccount'
                                defaultMessage='Already have an account?'
                            />
                            {' '}
                            <Link
                                to={'/login'}
                                query={this.props.location.query}
                            >
                                <FormattedMessage
                                    id='signup_user_completed.signIn'
                                    defaultMessage='Click here to sign in.'
                                />
                            </Link>
                        </span>
                        {signupMessage}
                        {ldapSignup}
                        {emailSignup}
                        {serverError}
                        {terms}
                    </div>
                </div>
            </div>
        );
    }
}
