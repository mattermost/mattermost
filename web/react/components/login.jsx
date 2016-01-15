// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginEmail from './login_email.jsx';
import LoginLdap from './login_ldap.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

const messages = defineMessages({
    gitlab: {
        id: 'login.gitlab',
        defaultMessage: 'with GitLab'
    },
    google:{
        id: 'login.google',
        defaultMessage: 'with Google Apps'
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
    },
    changed: {
        id: 'login.changed',
        defaultMessage: ' Sign-in method changed successfully'
    }
});

class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    render() {
        const {formatMessage} = this.props.intl;
        const teamDisplayName = this.props.teamDisplayName;
        const teamName = this.props.teamName;

        let loginMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        href={'/' + teamName + '/login/gitlab'}
                        key='gitlab'
                    >
                        <span className='icon' />
                        <span>{formatMessage(messages.gitlab)}</span>
                    </a>
           );
        }

        if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login google'
                        href={'/' + teamName + '/login/google'}
                    >
                        <span className='icon' />
                        <span>{formatMessage(messages.google)}</span>
                    </a>
           );
        }

        const extraParam = Utils.getUrlParameter('extra');
        let extraBox = '';
        if (extraParam) {
            let msg;
            if (extraParam === Constants.SIGNIN_CHANGE) {
                msg = formatMessage(messages.changed);
            } else if (extraParam === Constants.SIGNIN_VERIFIED) {
                msg = formatMessage(messages.verified);
            }

            if (msg != null) {
                extraBox = (
                    <div className='alert alert-success'>
                        <i className='fa fa-check' />
                        {msg}
                    </div>
                );
            }
        }

        let emailSignup;
        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            emailSignup = (
                <LoginEmail
                    teamName={this.props.teamName}
                />
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

        let ldapLogin = null;
        if (global.window.mm_config.EnableLdap === 'true') {
            ldapLogin = (
                <LoginLdap
                    teamName={this.props.teamName}
                />
            );
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>{formatMessage(messages.signTo)}</h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>{formatMessage(messages.on) + global.window.mm_config.SiteName}</h2>
                    {extraBox}
                    {loginMessage}
                    {emailSignup}
                    {ldapLogin}
                    {userSignUp}
                    <div className='form-group margin--extra form-group--small'>
                        <span><a href='/find_team'>{formatMessage(messages.find)}</a></span>
                    </div>
                    {forgotPassword}
                    {teamSignUp}
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