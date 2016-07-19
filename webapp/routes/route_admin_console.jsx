// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';
import {Route, Redirect, IndexRedirect} from 'react-router/es6';
import React from 'react';

import SystemAnalytics from 'components/analytics/system_analytics.jsx';
import ConfigurationSettings from 'components/admin_console/configuration_settings.jsx';
import LocalizationSettings from 'components/admin_console/localization_settings.jsx';
import UsersAndTeamsSettings from 'components/admin_console/users_and_teams_settings.jsx';
import PrivacySettings from 'components/admin_console/privacy_settings.jsx';
import PolicySettings from 'components/admin_console/policy_settings.jsx';
import LogSettings from 'components/admin_console/log_settings.jsx';
import EmailAuthenticationSettings from 'components/admin_console/email_authentication_settings.jsx';
import GitLabSettings from 'components/admin_console/gitlab_settings.jsx';
import OAuthSettings from 'components/admin_console/oauth_settings.jsx';
import LdapSettings from 'components/admin_console/ldap_settings.jsx';
import SamlSettings from 'components/admin_console/saml_settings.jsx';
import SignupSettings from 'components/admin_console/signup_settings.jsx';
import PasswordSettings from 'components/admin_console/password_settings.jsx';
import PublicLinkSettings from 'components/admin_console/public_link_settings.jsx';
import SessionSettings from 'components/admin_console/session_settings.jsx';
import ConnectionSettings from 'components/admin_console/connection_settings.jsx';
import EmailSettings from 'components/admin_console/email_settings.jsx';
import PushSettings from 'components/admin_console/push_settings.jsx';
import WebhookSettings from 'components/admin_console/webhook_settings.jsx';
import ExternalServiceSettings from 'components/admin_console/external_service_settings.jsx';
import DatabaseSettings from 'components/admin_console/database_settings.jsx';
import StorageSettings from 'components/admin_console/storage_settings.jsx';
import ImageSettings from 'components/admin_console/image_settings.jsx';
import CustomBrandSettings from 'components/admin_console/custom_brand_settings.jsx';
import CustomEmojiSettings from 'components/admin_console/custom_emoji_settings.jsx';
import LegalAndSupportSettings from 'components/admin_console/legal_and_support_settings.jsx';
import NativeAppLinkSettings from 'components/admin_console/native_app_link_settings.jsx';
import ComplianceSettings from 'components/admin_console/compliance_settings.jsx';
import RateSettings from 'components/admin_console/rate_settings.jsx';
import DeveloperSettings from 'components/admin_console/developer_settings.jsx';
import TeamUsers from 'components/admin_console/team_users.jsx';
import TeamAnalytics from 'components/analytics/team_analytics.jsx';
import LicenseSettings from 'components/admin_console/license_settings.jsx';
import Audits from 'components/admin_console/audits.jsx';
import Logs from 'components/admin_console/logs.jsx';

export default (
    <Route>
        <Route
            path='system_analytics'
            component={SystemAnalytics}
        />
        <Route path='general'>
            <IndexRedirect to='configuration'/>
            <Route
                path='configuration'
                component={ConfigurationSettings}
            />
            <Route
                path='localization'
                component={LocalizationSettings}
            />
            <Route
                path='users_and_teams'
                component={UsersAndTeamsSettings}
            />
            <Route
                path='privacy'
                component={PrivacySettings}
            />
            <Route
                path='policy'
                component={PolicySettings}
            />
            <Route
                path='compliance'
                component={ComplianceSettings}
            />
            <Route
                path='logging'
                component={LogSettings}
            />
        </Route>
        <Route path='authentication'>
            <IndexRedirect to='email'/>
            <Route
                path='email'
                component={EmailAuthenticationSettings}
            />
            <Route
                path='gitlab'
                component={GitLabSettings}
            />
            <Route
                path='ldap'
                component={LdapSettings}
            />
            <Route
                path='saml'
                component={SamlSettings}
            />
        </Route>
        <Route path='security'>
            <IndexRedirect to='sign_up'/>
            <Route
                path='sign_up'
                component={SignupSettings}
            />
            <Route
                path='password'
                component={PasswordSettings}
            />
            <Route
                path='public_links'
                component={PublicLinkSettings}
            />
            <Route
                path='sessions'
                component={SessionSettings}
            />
            <Route
                path='connections'
                component={ConnectionSettings}
            />
        </Route>
        <Route path='notifications'>
            <IndexRedirect to='email'/>
            <Route
                path='email'
                component={EmailSettings}
            />
            <Route
                path='push'
                component={PushSettings}
            />
        </Route>
        <Route path='integrations'>
            <IndexRedirect to='webhooks'/>
            <Route
                path='webhooks'
                component={WebhookSettings}
            />
            <Route
                path='external'
                component={ExternalServiceSettings}
            />
            <Route
                path='oauth2'
                component={OAuthSettings}
            />
        </Route>
        <Route path='files'>
            <IndexRedirect to='storage'/>
            <Route
                path='storage'
                component={StorageSettings}
            />
            <Route
                path='images'
                component={ImageSettings}
            />
        </Route>
        <Route path='customization'>
            <IndexRedirect to='custom_brand'/>
            <Route
                path='custom_brand'
                component={CustomBrandSettings}
            />
            <Route
                path='custom_emoji'
                component={CustomEmojiSettings}
            />
            <Route
                path='legal_and_support'
                component={LegalAndSupportSettings}
            />
            <Route
                path='native_app_links'
                component={NativeAppLinkSettings}
            />
        </Route>
        <Route path='advanced'>
            <IndexRedirect to='rate'/>
            <Route
                path='rate'
                component={RateSettings}
            />
            <Route
                path='database'
                component={DatabaseSettings}
            />
            <Route
                path='developer'
                component={DeveloperSettings}
            />
        </Route>
        <Route path='team'>
            <Redirect
                from=':team'
                to=':team/users'
            />
            <Route
                path=':team/users'
                component={TeamUsers}
            />
            <Route
                path=':team/analytics'
                component={TeamAnalytics}
            />
            <Redirect
                from='*'
                to='/error'
                query={RouteUtils.notFoundParams}
            />
        </Route>
        <Route
            path='license'
            component={LicenseSettings}
        />
        <Route
            path='audits'
            component={Audits}
        />
        <Route
            path='logs'
            component={Logs}
        />
    </Route>
);
