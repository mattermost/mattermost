// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import FormError from 'components/form_error.jsx';

import UserStore from 'stores/user_store.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import logoImage from 'images/logo.png';
import ErrorBar from 'components/error_bar.jsx';

import {FormattedMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';

export default class SignupController extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            emailEnabled: global.window.mm_config.EnableSignUpWithEmail === 'true',
            gitlabEnabled: global.window.mm_config.EnableSignUpWithGitLab === 'true',
            googleEnabled: global.window.mm_config.EnableSignUpWithGoogle === 'true',
            office365Enabled: global.window.mm_config.EnableSignUpWithOffice365 === 'true',
            ldapEnabled: global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableLdap === 'true',
            samlEnabled: global.window.mm_license.IsLicensed === 'true' && global.window.mm_config.EnableSaml === 'true',
            teamName: ''
        };
    }

    componentWillMount() {
        if (window.location.query) {
            const hash = window.location.query.h;
            const data = window.location.query.d;

            if (hash) {
                const parsedData = JSON.parse(data);
                this.setState({
                    teamName: parsedData.name
                });
            }
        }
    }

    componentDidMount() {
        if (UserStore.getCurrentUser()) {
            browserHistory.push('/select_team');
        }

        AsyncClient.checkVersion();
    }

    render() {
        let signupControls = [];

        if (this.state.emailEnabled) {
            signupControls.push(
                <Link
                    className='btn btn-custom-login email'
                    key='email'
                    to={'/signup_email' + window.location.search}
                >

                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.email'
                            defaultMessage='Email and Password'
                        />
                    </span>
                </Link>
            );
        }

        if (this.state.gitlabEnabled) {
            signupControls.push(
                <Link
                    className='btn btn-custom-login gitlab'
                    key='gitlab'
                    to={Client.getOAuthRoute() + '/gitlab/signup' + window.location.search}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.gitlab'
                            defaultMessage='GitLab Single-Sign-On'
                        />
                    </span>
                </Link>
            );
        }

        if (this.state.googleEnabled) {
            signupControls.push(
                <Link
                    className='btn btn-custom-login google'
                    key='google'
                    to={Client.getOAuthRoute() + '/google/signup' + window.location.search + '&team=' + encodeURIComponent(this.state.teamName)}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.google'
                            defaultMessage='Google Account'
                        />
                    </span>
                </Link>
            );
        }

        if (this.state.office365Enabled) {
            signupControls.push(
                <a
                    className='btn btn-custom-login office365'
                    key='office365'
                    href={Client.getOAuthRoute() + '/office365/signup' + window.location.search + '&team=' + encodeURIComponent(this.state.teamName)}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.office365'
                            defaultMessage='Office 365'
                        />
                    </span>
                </a>
           );
        }

        if (this.state.ldapEnabled) {
            signupControls.push(
                <Link
                    className='btn btn-custom-login ldap'
                    key='ldap'
                    to={'/signup_ldap'}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.ldap'
                            defaultMessage='LDAP Credentials'
                        />
                    </span>
                </Link>
            );
        }

        if (this.state.samlEnabled) {
            signupControls.push(
                <Link
                    className='btn btn-custom-login saml'
                    key='saml'
                    to={'/login/sso/saml'}
                >
                    <span className='icon'/>
                    <span>
                        <FormattedMessage
                            id='signup.saml'
                            defaultMessage='SAML Credentials'
                        />
                    </span>
                </Link>
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
        }

        return (
            <div>
                <ErrorBar/>
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
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
