// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoginEmail from './login_email.jsx';
import LoginUsername from './login_username.jsx';
import LoginLdap from './login_ldap.jsx';

import * as Utils from '../utils/utils.jsx';
import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';
import TeamStore from '../stores/team_store.jsx';

import {FormattedMessage} from 'mm-intl';
import {browserHistory} from 'react-router';

export default class Login extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onTeamChange = this.onTeamChange.bind(this);

        this.state = this.getStateFromStores();
    }
    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
        Client.getMeLoggedIn((data) => {
            if (data && data.logged_in !== 'false') {
                browserHistory.push('/' + this.props.params.team + '/channels/town-square');
            }
        });
    }
    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }
    getStateFromStores() {
        return {
            currentTeam: TeamStore.getByName(this.props.params.team)
        };
    }
    onTeamChange() {
        this.setState(this.getStateFromStores());
    }
    render() {
        const currentTeam = this.state.currentTeam;
        if (currentTeam == null) {
            return <div/>;
        }

        const teamDisplayName = currentTeam.display_name;
        const teamName = currentTeam.name;
        const ldapEnabled = global.window.mm_config.EnableLdap === 'true';
        const usernameSigninEnabled = global.window.mm_config.EnableSignInWithUsername === 'true';

        let loginMessage = [];
        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            loginMessage.push(
                <a
                    className='btn btn-custom-login gitlab'
                    key='gitlab'
                    href={'/api/v1/oauth/gitlab/login?team=' + encodeURIComponent(teamName)}
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

        if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
            loginMessage.push(
                <a
                    className='btn btn-custom-login google'
                    key='google'
                    href={'/api/v1/oauth/google/login?team=' + encodeURIComponent(teamName)}
                >
                    <span className='icon'/>
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
            }
        }

        let emailSignup;
        if (global.window.mm_config.EnableSignInWithEmail === 'true') {
            emailSignup = (
                <LoginEmail
                    teamName={teamName}
                />
            );
        }

        if (loginMessage.length > 0 && emailSignup) {
            loginMessage = (
                <div>
                    {loginMessage}
                    <div className='or__container'>
                        <FormattedMessage
                            id='login.or'
                            defaultMessage='or'
                        />
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
        if (currentTeam.allow_open_invite) {
            userSignUp = (
                <div>
                    <span>
                        <FormattedMessage
                            id='login.noAccount'
                            defaultMessage="Don't have an account? "
                        />
                        <a
                            href={'/signup_user_complete/?id=' + currentTeam.invite_id}
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
                    teamName={teamName}
                />
            );
        }

        if (ldapEnabled && (loginMessage.length > 0 || emailSignup || usernameSigninEnabled)) {
            ldapLogin = (
                <div>
                    <div className='or__container'>
                        <FormattedMessage
                            id='login.or'
                            defaultMessage='or'
                        />
                    </div>
                    <LoginLdap
                        teamName={teamName}
                    />
                </div>
            );
        }

        let usernameLogin = null;
        if (global.window.mm_config.EnableSignInWithUsername === 'true') {
            usernameLogin = (
                <LoginUsername
                    teamName={teamName}
                />
            );
        }

        if (usernameSigninEnabled && (loginMessage.length > 0 || emailSignup || ldapEnabled)) {
            usernameLogin = (
                <div>
                    <div className='or__container'>
                        <FormattedMessage
                            id='login.or'
                            defaultMessage='or'
                        />
                    </div>
                    <LoginUsername
                        teamName={teamName}
                    />
                </div>
            );
        }

        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
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
                        {forgotPassword}
                        {teamSignUp}
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
