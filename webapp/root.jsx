// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
require('perfect-scrollbar/jquery')($);

import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';

import React from 'react';
import ReactDOM from 'react-dom';
import {Router, Route, IndexRoute, Redirect, browserHistory} from 'react-router';
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
import * as Utils from 'utils/utils.jsx';

import Client from 'utils/web_client.jsx';

import * as Websockets from 'action_creators/websocket_actions.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';
import SignupUserComplete from 'components/signup_user_complete.jsx';
import ShouldVerifyEmail from 'components/should_verify_email.jsx';
import DoVerifyEmail from 'components/do_verify_email.jsx';
import AdminConsole from 'components/admin_console/admin_controller.jsx';
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

import Claim from 'components/claim/claim.jsx';
import EmailToOAuth from 'components/claim/components/email_to_oauth.jsx';
import OAuthToEmail from 'components/claim/components/oauth_to_email.jsx';
import LDAPToEmail from 'components/claim/components/ldap_to_email.jsx';
import EmailToLDAP from 'components/claim/components/email_to_ldap.jsx';

import Login from 'components/login/login.jsx';
import SelectTeam from 'components/select_team/select_team.jsx';
import CreateTeam from 'components/create_team/create_team.jsx';
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
            url: '/api/v3/admin/log_client',
            dataType: 'json',
            contentType: 'application/json',
            type: 'POST',
            data: JSON.stringify(l)
        });

        if (window.mm_config && window.mm_config.EnableDeveloper === 'true') {
            window.ErrorStore.storeLastError({message: 'DEVELOPER MODE: A javascript error has occured.  Please use the javascript console to capture and report the error (row: ' + line + ' col: ' + column + ').'});
            window.ErrorStore.emitChange();
        }
    };

    var d1 = $.Deferred(); //eslint-disable-line new-cap

    GlobalActions.emitInitialLoad(
        () => {
            d1.resolve();
        }
    );

    // Make sure the websockets close
    $(window).on('beforeunload',
         () => {
             Websockets.close();
         }
    );

    function afterIntl() {
        I18n.doAddLocaleData();
        $.when(d1).done(() => {
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

    if (!team) {
        browserHistory.push('/error');
        return;
    }

    GlobalActions.emitCloseRightHandSide();

    TeamStore.saveMyTeam(team);
    TeamStore.emitChange();

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

function onChannelEnter(nextState, replace) {
    doChannelChange(nextState, replace);
}

function onChannelChange(prevState, nextState, replace) {
    if (prevState.params.channel !== nextState.params.channel) {
        doChannelChange(nextState, replace);
    }
}

function doChannelChange(state, replace) {
    let channel;
    if (state.location.query.fakechannel) {
        channel = JSON.parse(state.location.query.fakechannel);
    } else {
        channel = ChannelStore.getByName(state.params.channel);
        if (!channel) {
            channel = ChannelStore.getMoreByName(state.params.channel);
        }
        if (!channel) {
            replace('/');
            return;
        }
    }
    GlobalActions.emitChannelClickEvent(channel);
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
                        component={Login}
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
                        component={Claim}
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
                            component={CreateTeam}
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
                    />
                    <Route
                        path=':team'
                        component={NeedsTeam}
                        onEnter={preNeedsTeam}
                    >
                        <Route
                            path='channels/:channel'
                            onEnter={onChannelEnter}
                            onChange={onChannelChange}
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
