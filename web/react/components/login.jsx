// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginEmail from './login_email.jsx';
import LoginUsername from './login_username.jsx';
import LoginLdap from './login_ldap.jsx';

import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    render() {
        const teamDisplayName = this.props.teamDisplayName;
        const teamName = this.props.teamName;

        let loginMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login gitlab'
                        key='gitlab'
                        href={'/' + teamName + '/login/gitlab'}
                    >
                        <span className='icon' />
                        <span>
                            <FormattedMessage
                                id='login.gitlab'
                                defaultMessage='with GitLab'
                            />
                        </span>
                    </a>
            );
        }

        if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            loginMessage.push(
                    <a
                        className='btn btn-custom-login google'
                        key='google'
                        href={'/' + teamName + '/login/google'}
                    >
                        <span className='icon' />
                        <span>
                            <FormattedMessage
                                id='login.google'
                                defaultMessage='with Google Apps'
                            />
                        </span>
                    </a>
           );
        }

        const extraParam = Utils.getUrlParameter('extra');
        let extraBox = '';
        if (extraParam) {
            let msg;
            if (extraParam === Constants.SIGNIN_CHANGE) {
                msg = (
                    <FormattedMessage
                        id='login.changed'
                        defaultMessage=' Sign-in method changed successfully'
                    />
                );
            } else if (extraParam === Constants.SIGNIN_VERIFIED) {
                msg = (
                    <FormattedMessage
                        id='login.verified'
                        defaultMessage=' Email Verified'
                    />
                );
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
        if (global.window.mm_config.EnableSignInWithEmail === 'true') {
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
                        <span>
                            <FormattedMessage
                                id='login.or'
                                defaultMessage='or'
                            />
                        </span>
                    </div>
                </div>
            );
        }

        let forgotPassword;
        if (emailSignup) {
            forgotPassword = (
                <div className='form-group'>
                    <a href={'/' + teamName + '/reset_password'}>
                        <FormattedMessage
                            id='login.forgot'
                            defaultMessage='I forgot my password'
                        />
                    </a>
                </div>
            );
        }

        let userSignUp = null;
        if (this.props.inviteId) {
            userSignUp = (
                <div>
                    <span>
                        <FormattedMessage
                            id='login.noAccount'
                            defaultMessage="Don't have an account? "
                        />
                        <a
                            href={'/signup_user_complete/?id=' + this.props.inviteId}
                            className='signup-team-login'
                        >
                            <FormattedMessage
                                id='login.create'
                                defaultMessage='Create one now'
                            />
                        </a>
                    </span>
                </div>
            );
        }

        let teamSignUp = null;
        if (global.window.mm_config.EnableTeamCreation === 'true' && !Utils.isMobileApp()) {
            teamSignUp = (
                <div className='margin--extra'>
                    <a
                        href='/'
                        className='signup-team-login'
                    >
                        <FormattedMessage
                            id='login.createTeam'
                            defaultMessage='Create a new team'
                        />
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

        let findTeams = null;
        if (!Utils.isMobileApp()) {
            findTeams = (
                <div className='form-group margin--extra form-group--small'>
                    <span>
                        <a href='/find_team'>
                            <FormattedMessage
                                id='login.find'
                                defaultMessage='Find your other teams'
                            />
                        </a></span>
                </div>
            );
        }

        let usernameLogin = null;
        if (global.window.mm_config.EnableSignInWithUsername === 'true') {
            usernameLogin = (
                <LoginUsername
                    teamName={this.props.teamName}
                />
            );
        }

        return (
            <div className='signup-team__container'>
                <h5 className='margin--less'>
                    <FormattedMessage
                        id='login.signTo'
                        defaultMessage='Sign in to:'
                    />
                </h5>
                <h2 className='signup-team__name'>{teamDisplayName}</h2>
                <h2 className='signup-team__subdomain'>
                    <FormattedMessage
                        id='login.on'
                        defaultMessage='on {siteName}'
                        values={{
                            siteName: global.window.mm_config.SiteName
                        }}
                    />
                </h2>
                    {extraBox}
                    {loginMessage}
                    {emailSignup}
                    {usernameLogin}
                    {ldapLogin}
                    {userSignUp}
                    {findTeams}
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
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    inviteId: React.PropTypes.string
};
