// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ChannelsPage from './channels';
import KeycloakLoginPage from './keycloak_login';
import LandingLoginPage from './landing_login';
import LoginPage from './login';
import RecapsPage from './recaps';
import ResetPasswordPage from './reset_password';
import SignupPage from './signup';
import SelectTeamPage from './select_team';
import ShouldVerifyEmailPage from './should_verify_email';
import MfaSetupPage from './mfa_setup';
import EmailToOAuthPage from './email_to_oauth';
import OAuthToEmailPage from './oauth_to_email';
import EmailToLdapPage from './email_to_ldap';
import LdapToEmailPage from './ldap_to_email';
import SystemConsolePage from './system_console';
import ScheduledPostsPage from './scheduled_posts';
import DraftsPage from './drafts';
import ErrorPage from './error';
import ThreadsPage from './threads';
import ContentReviewPage from './content_review_dm';

const pages = {
    ChannelsPage,
    KeycloakLoginPage,
    LandingLoginPage,
    LoginPage,
    RecapsPage,
    ResetPasswordPage,
    SignupPage,
    SelectTeamPage,
    ShouldVerifyEmailPage,
    MfaSetupPage,
    EmailToOAuthPage,
    OAuthToEmailPage,
    EmailToLdapPage,
    LdapToEmailPage,
    ScheduledPostsPage,
    ContentReviewPage,
    SystemConsolePage,
    DraftsPage,
    ErrorPage,
    ThreadsPage,
};

export {
    pages,
    ChannelsPage,
    ContentReviewPage,
    DraftsPage,
    ErrorPage,
    KeycloakLoginPage,
    LandingLoginPage,
    LoginPage,
    RecapsPage,
    ResetPasswordPage,
    SignupPage,
    SelectTeamPage,
    ShouldVerifyEmailPage,
    MfaSetupPage,
    EmailToOAuthPage,
    OAuthToEmailPage,
    EmailToLdapPage,
    LdapToEmailPage,
    ScheduledPostsPage,
    SystemConsolePage,
};
