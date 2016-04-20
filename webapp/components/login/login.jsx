// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginEmail from './components/login_email.jsx';
import LoginUsername from './components/login_username.jsx';
import LoginLdap from './components/login_ldap.jsx';
import LoginMfa from './components/login_mfa.jsx';
import ErrorBar from 'components/error_bar.jsx';

import * as GlobalActions from '../../action_creators/global_actions.jsx';
import UserStore from 'stores/user_store.jsx';

import Client from 'utils/web_client.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router';

import React from 'react';
import logoImage from 'images/logo.png';

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.preSubmit = this.preSubmit.bind(this);
        this.submit = this.submit.bind(this);
        this.finishSignin = this.finishSignin.bind(this);

        const state = {};
        state.showMfa = false;
        this.state = state;
    }
    componentDidMount() {
        if (UserStore.getCurrentUser()) {
            browserHistory.push('/select_team');
        }
    }
    preSubmit(method, loginId, password) {
        if (global.window.mm_config.EnableMultifactorAuthentication !== 'true') {
            this.submit(method, loginId, password, '');
            return;
        }

        Client.checkMfa(method, loginId,
            (data) => {
                if (data.mfa_required === 'true') {
                    this.setState({showMfa: true, method, loginId, password});
                } else {
                    this.submit(method, loginId, password, '');
                }
            },
            (err) => {
                if (method === Constants.EMAIL_SERVICE) {
                    this.setState({serverEmailError: err.message});
                } else if (method === Constants.USERNAME_SERVICE) {
                    this.setState({serverUsernameError: err.message});
                } else if (method === Constants.LDAP_SERVICE) {
                    this.setState({serverLdapError: err.message});
                }
            }
        );
    }
    finishSignin() {
        GlobalActions.emitInitialLoad(
            () => {
                browserHistory.push('/select_team');
            }
        );
    }

    submit(method, loginId, password, token) {
        this.setState({showMfa: false, serverEmailError: null, serverUsernameError: null, serverLdapError: null});

        if (method === Constants.EMAIL_SERVICE) {
            Client.webLogin(
                loginId,
                null,
                password,
                token,
                () => {
                    UserStore.setLastEmail(loginId);
                    this.finishSignin();
                },
                (err) => {
                    if (err.id === 'api.user.login.not_verified.app_error') {
                        browserHistory.push('/should_verify_email?&email=' + encodeURIComponent(loginId));
                        return;
                    }
                    this.setState({serverEmailError: err.message});
                }
            );
        } else if (method === Constants.USERNAME_SERVICE) {
            Client.webLogin(
                null,
                loginId,
                password,
                token,
                () => {
                    UserStore.setLastUsername(loginId);

                    const redirect = Utils.getUrlParameter('redirect');
                    if (redirect) {
                        browserHistory.push(decodeURIComponent(redirect));
                    } else {
                        this.finishSignin();
                    }
                },
                (err) => {
                    if (err.id === 'api.user.login.not_verified.app_error') {
                        this.setState({serverUsernameError: Utils.localizeMessage('login_username.verifyEmailError', 'Please verify your email address. Check your inbox for an email.')});
                    } else if (err.id === 'store.sql_user.get_by_username.app_error') {
                        this.setState({serverUsernameError: Utils.localizeMessage('login_username.userNotFoundError', 'We couldn\'t find an existing account matching your username for this team.')});
                    } else {
                        this.setState({serverUsernameError: err.message});
                    }
                }
            );
        } else if (method === Constants.LDAP_SERVICE) {
            Client.loginByLdap(
                loginId,
                password,
                token,
                () => {
                    const redirect = Utils.getUrlParameter('redirect');
                    if (redirect) {
                        browserHistory.push(decodeURIComponent(redirect));
                    } else {
                        this.finishSignin();
                    }
                },
                (err) => {
                    this.setState({serverLdapError: err.message});
                }
            );
        }
    }
    createCustomLogin() {
        if (global.window.mm_license.IsLicensed === 'true' &&
                global.window.mm_license.CustomBrand === 'true' &&
                global.window.mm_config.EnableCustomBrand === 'true') {
            const text = global.window.mm_config.CustomBrandText || '';

            return (
                <div>
                    <img
                        src={Client.getAdminRoute() + '/get_brand_image'}
                    />
                    <p dangerouslySetInnerHTML={{__html: TextFormatting.formatText(text)}}/>
                </div>
            );
        }

        return null;
    }
    createLoginOptions() {
        const extraParam = Utils.getUrlParameter('extra');
        let extraBox = '';
        if (extraParam) {
            if (extraParam === Constants.SIGNIN_CHANGE) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='login.changed'
                            defaultMessage=' Sign-in method changed successfully'
                        />
                    </div>
                );
            } else if (extraParam === Constants.SIGNIN_VERIFIED) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='login.verified'
                            defaultMessage=' Email Verified'
                        />
                    </div>
                );
            } else if (extraParam === Constants.SESSION_EXPIRED) {
                extraBox = (
                    <div className='alert alert-warning'>
                        <i className='fa fa-exclamation-triangle'/>
                        <FormattedMessage
                            id='login.session_expired'
                            defaultMessage=' Your session has expired. Please login again.'
                        />
                    </div>
                );
            } else if (extraParam === Constants.PASSWORD_CHANGE) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check'/>
                        <FormattedMessage
                            id='login.passwordChanged'
                            defaultMessage=' Password updated successfully'
                        />
                    </div>
                );
            }
        }

        const ldapEnabled = global.window.mm_config.EnableLdap === 'true';
        const gitlabSigninEnabled = global.window.mm_config.EnableSignUpWithGitLab === 'true';
        const googleSigninEnabled = global.window.mm_config.EnableSignUpWithGoogle === 'true';
        const usernameSigninEnabled = global.window.mm_config.EnableSignInWithUsername === 'true';
        const emailSigninEnabled = global.window.mm_config.EnableSignInWithEmail === 'true';

        const oauthLogins = [];
        if (gitlabSigninEnabled) {
            oauthLogins.push(
                <a
                    className='btn btn-custom-login gitlab'
                    key='gitlab'
                    href={Client.getOAuthRoute() + '/gitlab/login'}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='login.gitlab'
                            defaultMessage='with GitLab'
                        />
                    </span>
                </a>
            );
        }

        if (googleSigninEnabled) {
            oauthLogins.push(
                <Link
                    className='btn btn-custom-login google'
                    key='google'
                    to={Client.getOAuthRoute() + '/google/login'}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='login.google'
                            defaultMessage='with Google Apps'
                        />
                    </span>
                </Link>
            );
        }

        let emailLogin;
        if (emailSigninEnabled) {
            emailLogin = (
                <LoginEmail
                    serverError={this.state.serverEmailError}
                    submit={this.preSubmit}
                />
            );

            if (oauthLogins.length > 0) {
                emailLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {emailLogin}
                    </div>
                );
            }
        }

        let usernameLogin;
        if (usernameSigninEnabled) {
            usernameLogin = (
                <LoginUsername
                    serverError={this.state.serverUsernameError}
                    submit={this.preSubmit}
                />
            );

            if (emailSigninEnabled || oauthLogins.length > 0) {
                usernameLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {usernameLogin}
                    </div>
                );
            }
        }

        let ldapLogin;
        if (ldapEnabled) {
            ldapLogin = (
                <LoginLdap
                    serverError={this.state.serverLdapError}
                    submit={this.preSubmit}
                />
            );

            if (emailSigninEnabled || usernameSigninEnabled || oauthLogins.length > 0) {
                ldapLogin = (
                    <div>
                        <div className='or__container'>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </div>
                        {ldapLogin}
                    </div>
                );
            }
        }

        const userSignUp = (
            <div>
                <span>
                    <FormattedMessage
                        id='login.noAccount'
                        defaultMessage="Don't have an account? "
                    />
                    <Link
                        to={'/signup_user_complete'}
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='login.create'
                            defaultMessage='Create one now'
                        />
                    </Link>
                </span>
            </div>
        );

        let forgotPassword;
        if (usernameSigninEnabled || emailSigninEnabled) {
            forgotPassword = (
                <div className='form-group'>
                    <Link to={'/reset_password'}>
                        <FormattedMessage
                            id='login.forgot'
                            defaultMessage='I forgot my password'
                        />
                    </Link>
                </div>
            );
        }

        return (
            <div>
                {extraBox}
                {oauthLogins}
                {emailLogin}
                {usernameLogin}
                {ldapLogin}
                {userSignUp}
                {forgotPassword}
            </div>
        );
    }
    render() {
        let content;
        let customContent;
        let customClass;
        if (this.state.showMfa) {
            content = (
                <LoginMfa
                    method={this.state.method}
                    loginId={this.state.loginId}
                    password={this.state.password}
                    submit={this.submit}
                />
            );
        } else {
            content = this.createLoginOptions();
            customContent = this.createCustomLogin();
            if (customContent) {
                customClass = 'branded';
            }
        }

        return (
            <div>
                <ErrorBar/>
                <div className='col-sm-12'>
                    <div className={'signup-team__container ' + customClass}>
                        <div className='signup__markdown'>
                            {customContent}
                        </div>
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
                        <div className='signup__content'>
                            {content}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

Login.defaultProps = {
};
Login.propTypes = {
    params: React.PropTypes.object.isRequired
};
