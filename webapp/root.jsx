// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
require('perfect-scrollbar/jquery')($);

import 'bootstrap-colorpicker/dist/css/bootstrap-colorpicker.css';
import 'google-fonts/google-fonts.css';
import 'sass/styles.scss';

import React from 'react';
import ReactDOM from 'react-dom';
import {Router, Route, IndexRoute, IndexRedirect, browserHistory} from 'react-router';
import Root from 'components/root.jsx';
import Login from 'components/login.jsx';
import LoggedIn from 'components/logged_in.jsx';
import NotLoggedIn from 'components/not_logged_in.jsx';
import NeedsTeam from 'components/needs_team.jsx';
import PasswordResetSendLink from 'components/password_reset_send_link.jsx';
import PasswordResetForm from 'components/password_reset_form.jsx';
import ChannelView from 'components/channel_view.jsx';
import PermalinkView from 'components/permalink_view.jsx';
import Sidebar from 'components/sidebar.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import SignupTeam from 'components/signup_team.jsx';
import * as Client from 'utils/client.jsx';
import * as Websockets from 'action_creators/websocket_actions.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';
import SignupTeamConfirm from 'components/signup_team_confirm.jsx';
import SignupUserComplete from 'components/signup_user_complete.jsx';
import ShouldVerifyEmail from 'components/should_verify_email.jsx';
import DoVerifyEmail from 'components/do_verify_email.jsx';
import AdminConsole from 'components/admin_console/admin_controller.jsx';
import TutorialView from 'components/tutorial/tutorial_view.jsx';
import BackstageNavbar from 'components/backstage/backstage_navbar.jsx';
import BackstageSidebar from 'components/backstage/backstage_sidebar.jsx';
import InstalledIntegrations from 'components/backstage/installed_integrations.jsx';

import SignupTeamComplete from 'components/signup_team_complete/components/signup_team_complete.jsx';
import WelcomePage from 'components/signup_team_complete/components/team_signup_welcome_page.jsx';
import TeamDisplayNamePage from 'components/signup_team_complete/components/team_signup_display_name_page.jsx';
import TeamURLPage from 'components/signup_team_complete/components/team_signup_url_page.jsx';
import SendInivtesPage from 'components/signup_team_complete/components/team_signup_send_invites_page.jsx';
import UsernamePage from 'components/signup_team_complete/components/team_signup_username_page.jsx';
import PasswordPage from 'components/signup_team_complete/components/team_signup_password_page.jsx';
import FinishedPage from 'components/signup_team_complete/components/team_signup_finished.jsx';

import Claim from 'components/claim/claim.jsx';
import EmailToOAuth from 'components/claim/components/email_to_oauth.jsx';
import OAuthToEmail from 'components/claim/components/oauth_to_email.jsx';
import LDAPToEmail from 'components/claim/components/ldap_to_email.jsx';
import EmailToLDAP from 'components/claim/components/email_to_ldap.jsx';

import * as I18n from 'i18n/i18n.jsx';

// This is for anything that needs to be done for ALL react components.
// This runs before we start to render anything.
function preRenderSetup(callwhendone) {
    const d1 = Client.getClientConfig(
        (data, textStatus, xhr) => {
            if (!data) {
                return;
            }

            global.window.mm_config = data;

            var serverVersion = xhr.getResponseHeader('X-Version-ID');

            if (serverVersion !== BrowserStore.getLastServerVersion()) {
                if (!BrowserStore.getLastServerVersion() || BrowserStore.getLastServerVersion() === '') {
                    BrowserStore.setLastServerVersion(serverVersion);
                } else {
                    BrowserStore.setLastServerVersion(serverVersion);
                    window.location.reload(true);
                    console.log('Detected version update refreshing the page'); //eslint-disable-line no-console
                }
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getClientConfig');
        }
    );

    const d2 = Client.getClientLicenceConfig(
        (data) => {
            if (!data) {
                return;
            }

            global.window.mm_license = data;
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getClientLicenceConfig');
        }
    );

    // Set these here so they don't fail in client.jsx track
    global.window.analytics = [];
    global.window.analytics.page = () => {
        // Do Nothing
    };
    global.window.analytics.track = () => {
        // Do Nothing
    };

    // Make sure the websockets close
    $(window).on('beforeunload',
         () => {
             Websockets.close();
         }
    );

    function afterIntl() {
        I18n.doAddLocaleData();
        $.when(d1, d2).done(callwhendone);
    }

    if (global.Intl) {
        afterIntl();
    } else {
        I18n.safariFix(afterIntl);
    }
}

function preLoggedIn(nextState, replace, callback) {
    const d1 = Client.getAllPreferences(
        (data) => {
            PreferenceStore.setPreferencesFromServer(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getAllPreferences');
        }
    );

    const d2 = AsyncClient.getChannels();

    $.when(d1, d2).done(() => {
        callback();
    });
}

function onRootEnter(nextState, replace, callback) {
    if (nextState.location.pathname === '/') {
        Client.getMeLoggedIn((data) => {
            if (!data || data.logged_in === 'false') {
                replace({pathname: '/signup_team'});
                callback();
            } else {
                replace({pathname: '/' + data.team_name + '/channels/town-square'});
                callback();
            }
        });
        return;
    }

    callback();
}

function onPermalinkEnter(nextState) {
    const postId = nextState.params.postid;

    GlobalActions.emitPostFocusEvent(postId);
}

function onChannelEnter(nextState) {
    doChannelChange(nextState);
}

function onChannelChange(prevState, nextState) {
    if (prevState.params.channel !== nextState.params.channel) {
        doChannelChange(nextState);
    }
}

function doChannelChange(state) {
    let channel;
    if (state.location.query.fakechannel) {
        channel = JSON.parse(state.location.query.fakechannel);
    } else {
        channel = ChannelStore.getByName(state.params.channel);
    }
    GlobalActions.emitChannelClickEvent(channel);
}

function onLoggedOut(nextState) {
    const teamName = nextState.params.team;
    Client.logout(
        () => {
            browserHistory.push('/' + teamName + '/login');
            BrowserStore.signalLogout();
            BrowserStore.clear();
            ErrorStore.clearLastError();
            PreferenceStore.clear();
        },
        () => {
            browserHistory.push('/' + teamName + '/login');
        }
    );
}

function renderRootComponent() {
    ReactDOM.render((
        <Router
            history={browserHistory}
        >
            <Route
                path='/'
                component={Root}
                onEnter={onRootEnter}
            >
                <Route
                    component={LoggedIn}
                    onEnter={preLoggedIn}
                >
                    <Route
                        path=':team/channels/:channel'
                        onEnter={onChannelEnter}
                        onChange={onChannelChange}
                        components={{
                            sidebar: Sidebar,
                            center: ChannelView
                        }}
                    />
                    <Route
                        path=':team/pl/:postid'
                        onEnter={onPermalinkEnter}
                        components={{
                            sidebar: Sidebar,
                            center: PermalinkView
                        }}
                    />
                    <Route
                        path=':team/tutorial'
                        components={{
                            sidebar: Sidebar,
                            center: TutorialView
                        }}
                    />
                    <Route
                        path=':team/logout'
                        onEnter={onLoggedOut}
                    />
                    <Route
                        path=':team/team_settings'
                        components={{
                            navbar: BackstageNavbar,
                            sidebar: BackstageSidebar,
                            center: null
                        }}
                    />
                    <Route path=':team/integrations'>
                        <IndexRedirect to='installed'/>
                        <Route
                            path='installed'
                            components={{
                                navbar: BackstageNavbar,
                                sidebar: BackstageSidebar,
                                center: InstalledIntegrations
                            }}
                        />
                        <Route path='add'>
                            <IndexRoute
                                components={{
                                    navbar: BackstageNavbar,
                                    sidebar: BackstageSidebar,
                                    center: null
                                }}
                            />
                            <Route
                                path='incoming_webhook'
                                components={{
                                    navbar: BackstageNavbar,
                                    sidebar: BackstageSidebar,
                                    center: null
                                }}
                            />
                            <Route
                                path='outgoing_webhook'
                                components={{
                                    navbar: BackstageNavbar,
                                    sidebar: BackstageSidebar,
                                    center: null
                                }}
                            />
                        </Route>
                    </Route>
>>>>>>> Added initial backstage components and InstalledIntegrations page
                    <Route
                        path='admin_console'
                        component={AdminConsole}
                    />
                </Route>
                <Route component={NotLoggedIn}>
                    <Route
                        path='signup_team'
                        component={SignupTeam}
                    />
                    <Route
                        path='signup_team_complete'
                        component={SignupTeamComplete}
                    >
                        <IndexRoute component={FinishedPage}/>
                        <Route
                            path='welcome'
                            component={WelcomePage}
                        />
                        <Route
                            path='team_display_name'
                            component={TeamDisplayNamePage}
                        />
                        <Route
                            path='team_url'
                            component={TeamURLPage}
                        />
                        <Route
                            path='invites'
                            component={SendInivtesPage}
                        />
                        <Route
                            path='username'
                            component={UsernamePage}
                        />
                        <Route
                            path='password'
                            component={PasswordPage}
                        />
                    </Route>
                    <Route
                        path='signup_user_complete'
                        component={SignupUserComplete}
                    />
                    <Route
                        path='signup_team_confirm'
                        component={SignupTeamConfirm}
                    />
                    <Route
                        path='should_verify_email'
                        component={ShouldVerifyEmail}
                    />
                    <Route
                        path='do_verify_email'
                        component={DoVerifyEmail}
                    />
                    <Route
                        path=':team'
                        component={NeedsTeam}
                    >
                        <IndexRedirect to='login'/>
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
                    </Route>
                </Route>
            </Route>
        </Router>
    ),
    document.getElementById('root'));
}

global.window.setup_root = () => {
    // Do the pre-render setup and call renderRootComponent when done
    preRenderSetup(renderRootComponent);
};
