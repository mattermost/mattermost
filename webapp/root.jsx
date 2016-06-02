// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
require('perfect-scrollbar/jquery')($);

import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';

import React from 'react';
import ReactDOM from 'react-dom';
import {IndexRedirect, Router, Route, IndexRoute, Redirect, browserHistory} from 'react-router';
import Root from 'components/root.jsx';
import LoggedIn from 'components/logged_in.jsx';
import HeaderFooterTemplate from 'components/header_footer_template.jsx';
import NeedsTeam from 'components/needs_team.jsx';
import PasswordResetSendLink from 'components/password_reset_send_link.jsx';
import PasswordResetForm from 'components/password_reset_form.jsx';
import ChannelView from 'components/channel_view.jsx';
import PermalinkView from 'components/permalink_view.jsx';
import Sidebar from 'components/sidebar.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import * as Utils from 'utils/utils.jsx';

import Client from 'utils/web_client.jsx';

import * as Websockets from 'actions/websocket_actions.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import SignupUserComplete from 'components/signup_user_complete.jsx';
import ShouldVerifyEmail from 'components/should_verify_email.jsx';
import DoVerifyEmail from 'components/do_verify_email.jsx';
import TutorialView from 'components/tutorial/tutorial_view.jsx';
import BackstageNavbar from 'components/backstage/backstage_navbar.jsx';
import BackstageSidebar from 'components/backstage/backstage_sidebar.jsx';
import Integrations from 'components/backstage/integrations.jsx';
import InstalledIncomingWebhooks from 'components/backstage/installed_incoming_webhooks.jsx';
import InstalledOutgoingWebhooks from 'components/backstage/installed_outgoing_webhooks.jsx';
import InstalledCommands from 'components/backstage/installed_commands.jsx';
import AddIncomingWebhook from 'components/backstage/add_incoming_webhook.jsx';
import AddOutgoingWebhook from 'components/backstage/add_outgoing_webhook.jsx';
import AddCommand from 'components/backstage/add_command.jsx';
import ErrorPage from 'components/error_page.jsx';

import AppDispatcher from './dispatcher/app_dispatcher.jsx';
import Constants from './utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import AdminConsole from 'components/admin_console/admin_console.jsx';
import SystemAnalytics from 'components/analytics/system_analytics.jsx';
import ConfigurationSettings from 'components/admin_console/configuration_settings.jsx';
import LocalizationSettings from 'components/admin_console/localization_settings.jsx';
import UsersAndTeamsSettings from 'components/admin_console/users_and_teams_settings.jsx';
import PrivacySettings from 'components/admin_console/privacy_settings.jsx';
import LogSettings from 'components/admin_console/log_settings.jsx';
import EmailAuthenticationSettings from 'components/admin_console/email_authentication_settings.jsx';
import GitLabSettings from 'components/admin_console/gitlab_settings.jsx';
import LdapSettings from 'components/admin_console/ldap_settings.jsx';
import SignupSettings from 'components/admin_console/signup_settings.jsx';
import LoginSettings from 'components/admin_console/login_settings.jsx';
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
import LegalAndSupportSettings from 'components/admin_console/legal_and_support_settings.jsx';
import ComplianceSettings from 'components/admin_console/compliance_settings.jsx';
import RateSettings from 'components/admin_console/rate_settings.jsx';
import DeveloperSettings from 'components/admin_console/developer_settings.jsx';
import TeamUsers from 'components/admin_console/team_users.jsx';
import TeamAnalytics from 'components/analytics/team_analytics.jsx';
import LicenseSettings from 'components/admin_console/license_settings.jsx';
import Audits from 'components/admin_console/audits.jsx';
import Logs from 'components/admin_console/logs.jsx';

import ClaimController from 'components/claim/claim_controller.jsx';
import EmailToOAuth from 'components/claim/components/email_to_oauth.jsx';
import OAuthToEmail from 'components/claim/components/oauth_to_email.jsx';
import LDAPToEmail from 'components/claim/components/ldap_to_email.jsx';
import EmailToLDAP from 'components/claim/components/email_to_ldap.jsx';

import LoginController from 'components/login/login_controller.jsx';
import SelectTeam from 'components/select_team/select_team.jsx';
import CreateTeamController from 'components/create_team/create_team_controller.jsx';
import CreateTeamDisplayName from 'components/create_team/components/display_name.jsx';
import CreateTeamTeamUrl from 'components/create_team/components/team_url.jsx';

import * as I18n from 'i18n/i18n.jsx';

const notFoundParams = {
    title: Utils.localizeMessage('error.not_found.title', 'Page not found'),
    message: Utils.localizeMessage('error.not_found.message', 'The page you where trying to reach does not exist'),
    link: '/',
    linkmessage: Utils.localizeMessage('error.not_found.link_message', 'Back to Mattermost')
};

// This is for anything that needs to be done for ALL react components.
// This runs before we start to render anything.
function preRenderSetup(callwhendone) {
    window.onerror = (msg, url, line, column, stack) => {
        var l = {};
        l.level = 'ERROR';
        l.message = 'msg: ' + msg + ' row: ' + line + ' col: ' + column + ' stack: ' + stack + ' url: ' + url;

        $.ajax({
            url: '/api/v3/general/log_client',
            dataType: 'json',
            contentType: 'application/json',
            type: 'POST',
            data: JSON.stringify(l)
        });

        if (window.mm_config && window.mm_config.EnableDeveloper === 'true') {
            window.ErrorStore.storeLastError({type: 'developer', message: 'DEVELOPER MODE: A javascript error has occured.  Please use the javascript console to capture and report the error (row: ' + line + ' col: ' + column + ').'});
            window.ErrorStore.emitChange();
        }
    };

    var d1 = $.Deferred(); //eslint-disable-line new-cap

    GlobalActions.emitInitialLoad(
        () => {
            d1.resolve();
        }
    );

    // Make sure the websockets close and reset version
    $(window).on('beforeunload',
         () => {
             BrowserStore.setLastServerVersion('');
             Websockets.close();
         }
    );

    function afterIntl() {
        $.when(d1).done(() => {
            I18n.doAddLocaleData();
            callwhendone();
        });
    }

    if (global.Intl) {
        afterIntl();
    } else {
        I18n.safariFix(afterIntl);
    }
}

function preLoggedIn(nextState, replace, callback) {
    ErrorStore.clearLastError();
    callback();
}

function preNeedsTeam(nextState, replace, callback) {
    // First check to make sure you're in the current team
    // for the current url.
    var teamName = Utils.getTeamNameFromUrl();
    var team = TeamStore.getByName(teamName);
    const oldTeamId = TeamStore.getCurrentId();

    if (!team) {
        browserHistory.push('/');
        return;
    }

    GlobalActions.emitCloseRightHandSide();

    TeamStore.saveMyTeam(team);
    TeamStore.emitChange();

    // If the old team id is null then we will already have the direct
    // profiles from initial load
    if (oldTeamId != null) {
        AsyncClient.getDirectProfiles();
    }

    var d1 = $.Deferred(); //eslint-disable-line new-cap
    var d2 = $.Deferred(); //eslint-disable-line new-cap

    Client.getChannels(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_CHANNELS,
                channels: data.channels,
                members: data.members
            });

            d1.resolve();
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getChannels');
            d1.resolve();
        }
    );

    Client.getProfiles(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILES,
                profiles: data
            });

            d2.resolve();
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getProfiles');
            d2.resolve();
        }
    );

    $.when(d1, d2).done(() => {
        callback();
    });
}

function onPermalinkEnter(nextState) {
    const postId = nextState.params.postid;
    GlobalActions.emitPostFocusEvent(postId);
}

function onChannelEnter(nextState, replace, callback) {
    doChannelChange(nextState, replace, callback);
}

function doChannelChange(state, replace, callback) {
    let channel;
    if (state.location.query.fakechannel) {
        channel = JSON.parse(state.location.query.fakechannel);
    } else {
        channel = ChannelStore.getByName(state.params.channel);
        if (!channel) {
            channel = ChannelStore.getMoreByName(state.params.channel);
        }
        if (!channel) {
            Client.joinChannelByName(
                state.params.channel,
                (data) => {
                    GlobalActions.emitChannelClickEvent(data);
                    callback();
                },
                () => {
                    if (state.params.team) {
                        replace('/' + state.params.team + '/channels/town-square');
                    } else {
                        replace('/');
                    }
                    callback();
                }
            );
            return;
        }
    }
    GlobalActions.emitChannelClickEvent(channel);
    callback();
}

function renderRootComponent() {
    ReactDOM.render((
        <Router
            history={browserHistory}
        >
            <Route
                path='/'
                component={Root}
            >
                <Route
                    path='error'
                    component={ErrorPage}
                />
                <Route component={HeaderFooterTemplate}>
                    <Route
                        path='login'
                        component={LoginController}
                    />
                    <Route
                        path='reset_password'
                        component={PasswordResetSendLink}
                    />
                    <Route
                        path='reset_password_complete'
                        component={PasswordResetForm}
                    />
                    <Route
                        path='claim'
                        component={ClaimController}
                    >
                        <Route
                            path='oauth_to_email'
                            component={OAuthToEmail}
                        />
                        <Route
                            path='email_to_oauth'
                            component={EmailToOAuth}
                        />
                        <Route
                            path='email_to_ldap'
                            component={EmailToLDAP}
                        />
                        <Route
                            path='ldap_to_email'
                            component={LDAPToEmail}
                        />
                    </Route>
                    <Route
                        path='signup_user_complete'
                        component={SignupUserComplete}
                    />
                    <Route
                        path='should_verify_email'
                        component={ShouldVerifyEmail}
                    />
                    <Route
                        path='do_verify_email'
                        component={DoVerifyEmail}
                    />
                </Route>
                <Route
                    component={LoggedIn}
                    onEnter={preLoggedIn}
                >
                    <Route component={HeaderFooterTemplate}>
                        <Route
                            path='select_team'
                            component={SelectTeam}
                        />
                        <Route
                            path='create_team'
                            component={CreateTeamController}
                        >
                            <IndexRoute component={CreateTeamDisplayName}/>
                            <Route
                                path='display_name'
                                component={CreateTeamDisplayName}
                            />
                            <Route
                                path='team_url'
                                component={CreateTeamTeamUrl}
                            />
                        </Route>
                    </Route>
                    <Route
                        path='admin_console'
                        component={AdminConsole}
                    >
                        <IndexRedirect to='system_analytics'/>
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
                        </Route>
                        <Route path='security'>
                            <IndexRedirect to='sign_up'/>
                            <Route
                                path='sign_up'
                                component={SignupSettings}
                            />
                            <Route
                                path='login'
                                component={LoginSettings}
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
                                path='legal_and_support'
                                component={LegalAndSupportSettings}
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
                                query={notFoundParams}
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
                    <Route
                        path=':team'
                        component={NeedsTeam}
                        onEnter={preNeedsTeam}
                    >
                        <IndexRedirect to='channels/town-square'/>
                        <Route
                            path='channels/:channel'
                            onEnter={onChannelEnter}
                            components={{
                                sidebar: Sidebar,
                                center: ChannelView
                            }}
                        />
                        <Route
                            path='pl/:postid'
                            onEnter={onPermalinkEnter}
                            components={{
                                sidebar: Sidebar,
                                center: PermalinkView
                            }}
                        />
                        <Route
                            path='tutorial'
                            components={{
                                sidebar: Sidebar,
                                center: TutorialView
                            }}
                        />
                        <Route path='settings/integrations'>
                            <IndexRoute
                                components={{
                                    navbar: BackstageNavbar,
                                    sidebar: BackstageSidebar,
                                    center: Integrations
                                }}
                            />
                            <Route path='incoming_webhooks'>
                                <IndexRoute
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: InstalledIncomingWebhooks
                                    }}
                                />
                                <Route
                                    path='add'
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: AddIncomingWebhook
                                    }}
                                />
                            </Route>
                            <Route path='outgoing_webhooks'>
                                <IndexRoute
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: InstalledOutgoingWebhooks
                                    }}
                                />
                                <Route
                                    path='add'
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: AddOutgoingWebhook
                                    }}
                                />
                            </Route>
                            <Route path='commands'>
                                <IndexRoute
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: InstalledCommands
                                    }}
                                />
                                <Route
                                    path='add'
                                    components={{
                                        navbar: BackstageNavbar,
                                        sidebar: BackstageSidebar,
                                        center: AddCommand
                                    }}
                                />
                            </Route>
                            <Redirect
                                from='*'
                                to='/error'
                                query={notFoundParams}
                            />
                        </Route>
                    </Route>
                </Route>
                <Redirect
                    from='*'
                    to='/error'
                    query={notFoundParams}
                />
            </Route>
        </Router>
    ),
    document.getElementById('root'));
}

global.window.setup_root = () => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent);
};
