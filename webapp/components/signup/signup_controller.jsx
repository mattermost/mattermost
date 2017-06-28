// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import FormError from 'components/form_error.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import UserStore from 'stores/user_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';

import {Client4} from 'mattermost-redux/client';
import * as GlobalActions from 'actions/global_actions.jsx';
import {addUserToTeamFromInvite, getInviteInfo} from 'actions/team_actions.jsx';
import {loadMe} from 'actions/user_actions.jsx';

import logoImage from 'images/logo.png';
import AnnouncementBar from 'components/announcement_bar';

import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

export default class SignupController extends React.Component {
    constructor(props) {
        super(props);

        this.renderSignupControls = this.renderSignupControls.bind(this);

        let loading = false;
        let serverError = '';
        let noOpenServerError = false;
        let usedBefore = false;

        if (props.location.query) {
            const hash = props.location.query.h;
            const inviteId = props.location.query.id;

            if (inviteId) {
                loading = true;
            } else if (hash && !UserStore.getCurrentUser()) {
                usedBefore = BrowserStore.getGlobalItem(hash);
            } else if (!inviteId && global.window.mm_config.EnableOpenServer !== 'true' && !UserStore.getNoAccounts()) {
                noOpenServerError = true;
                serverError = (
                    <FormattedMessage
                        id='signup_user_completed.no_open_server'
                        defaultMessage='This server does not allow open signups.  Please speak with your Administrator to receive an invitation.'
                    />
                );
            }
        }

        this.state = {
            loading,
            serverError,
            noOpenServerError,
            usedBefore
        };
    }

    componentDidMount() {
        BrowserStore.removeGlobalItem('team');
        if (this.props.location.query) {
            const hash = this.props.location.query.h;
            const data = this.props.location.query.d;
            const inviteId = this.props.location.query.id;

            const userLoggedIn = UserStore.getCurrentUser() != null;

            if ((inviteId || hash) && userLoggedIn) {
                addUserToTeamFromInvite(
                    data,
                    hash,
                    inviteId,
                    (team) => {
                        loadMe().then(
                            () => {
                                browserHistory.push('/' + team.name + '/channels/town-square');
                            }
                        );
                    },
                    this.handleInvalidInvite
                );

                return;
            }

            if (inviteId) {
                getInviteInfo(
                    inviteId,
                    (inviteData) => {
                        if (!inviteData) {
                            return;
                        }

                        this.setState({ // eslint-disable-line react/no-did-mount-set-state
                            serverError: '',
                            loading: false
                        });
                    },
                    this.handleInvalidInvite
                );

                return;
            }

            if (userLoggedIn) {
                GlobalActions.redirectUserToDefaultTeam();
            }
        }
    }

    handleInvalidInvite = (err) => {
        let serverError;
        if (err.server_error_id === 'store.sql_user.save.max_accounts.app_error') {
            serverError = err.message;
        } else {
            serverError = (
                <FormattedMessage
                    id='signup_user_completed.invalid_invite'
                    defaultMessage='The invite link was invalid.  Please speak with your Administrator to receive an invitation.'
                />
            );
        }

        this.setState({
            noOpenServerError: true,
            loading: false,
            serverError
        });
    }

    renderSignupControls() {
        let signupControls = [];

        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            signupControls.push(
                <Link
                    className='btn btn-custom-login btn--full email'
                    key='email'
                    to={'/signup_email' + window.location.search}
                >
                    <span>
                        <span className='icon fa fa-envelope'/>
                        <FormattedMessage
                            id='signup.email'
                            defaultMessage='Email and Password'
                        />
                    </span>
                </Link>
            );
        }

        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            signupControls.push(
                <a
                    className='btn btn-custom-login btn--full gitlab'
                    key='gitlab'
                    href={Client4.getOAuthRoute() + '/gitlab/signup' + window.location.search}
                >
                    <span>
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='signup.gitlab'
                                defaultMessage='GitLab Single Sign-On'
                            />
                        </span>
                    </span>
                </a>
            );
        }

        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            signupControls.push(
                <a
                    className='btn btn-custom-login btn--full google'
                    key='google'
                    href={Client4.getOAuthRoute() + '/google/signup' + window.location.search}
                >
                    <span>
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='signup.google'
                                defaultMessage='Google Account'
                            />
                        </span>
                    </span>
                </a>
            );
        }

        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableSignUpWithOffice365 === 'true') {
            signupControls.push(
                <a
                    className='btn btn-custom-login btn--full office365'
                    key='office365'
                    href={Client4.getOAuthRoute() + '/office365/signup' + window.location.search}
                >
                    <span>
                        <span className='icon'/>
                        <span>
                            <FormattedMessage
                                id='signup.office365'
                                defaultMessage='Office 365'
                            />
                        </span>
                    </span>
                </a>
            );
        }

        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableLdap === 'true') {
            signupControls.push(
                <Link
                    className='btn btn-custom-login btn--full ldap'
                    key='ldap'
                    to={'/signup_ldap' + window.location.search}
                >
                    <span>
                        <span className='icon fa fa-folder-open fa--margin-top'/>
                        <span>
                            <FormattedMessage
                                id='signup.ldap'
                                defaultMessage='AD/LDAP Credentials'
                            />
                        </span>
                    </span>
                </Link>
            );
        }

        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableSaml === 'true') {
            let query = '';
            if (window.location.search) {
                query = '&action=signup';
            } else {
                query = '?action=signup';
            }

            signupControls.push(
                <a
                    className='btn btn-custom-login btn--full saml'
                    key='saml'
                    href={'/login/sso/saml' + window.location.search + query}
                >
                    <span>
                        <span className='icon fa fa-lock fa--margin-top'/>
                        <span>
                            {global.window.mm_config.SamlLoginButtonText}
                        </span>
                    </span>
                </a>
            );
        }

        if (signupControls.length === 0) {
            const signupDisabledError = (
                <FormattedMessage
                    id='signup_user_completed.none'
                    defaultMessage='No user creation method has been enabled. Please contact an administrator for access.'
                />
            );
            signupControls = (
                <FormError
                    error={signupDisabledError}
                    margin={true}
                />
            );
        } else if (signupControls.length === 1) {
            if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
                return browserHistory.push('/signup_email' + window.location.search);
            } else if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableLdap === 'true') {
                return browserHistory.push('/signup_ldap' + window.location.search);
            }
        }

        return signupControls;
    }

    render() {
        if (this.state.loading) {
            return (<LoadingScreen/>);
        }

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

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className={'form-group has-error'}>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        let signupControls;
        if (this.state.noOpenServerError || this.state.usedBefore) {
            signupControls = null;
        } else {
            signupControls = this.renderSignupControls();
        }

        return (
            <div>
                <AnnouncementBar/>
                <div className='signup-header'>
                    <Link to='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </Link>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <div className='signup__content'>
                            <h1>{global.window.mm_config.SiteName}</h1>
                            <h4 className='color--light'>
                                <FormattedMessage
                                    id='web.root.signup_info'
                                />
                            </h4>
                            <div className='margin--extra'>
                                <h5><strong>
                                    <FormattedMessage
                                        id='signup.title'
                                        defaultMessage='Create an account with:'
                                    />
                                </strong></h5>
                            </div>
                            {signupControls}
                            {serverError}
                        </div>
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
                    </div>
                </div>
            </div>
        );
    }
}

SignupController.propTypes = {
    location: PropTypes.object
};
