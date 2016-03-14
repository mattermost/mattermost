// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {Router, Route, IndexRoute, IndexRedirect, browserHistory} from 'react-router';
import Root from '../components/root.jsx';
import Login from '../components/login.jsx';
import LoggedIn from '../components/logged_in.jsx';
import NotLoggedIn from '../components/not_logged_in.jsx';
import NeedsTeam from '../components/needs_team.jsx';
import PasswordResetSendLink from '../components/password_reset_send_link.jsx';
import PasswordResetForm from '../components/password_reset_form.jsx';
import ChannelView from '../components/channel_view.jsx';
import Sidebar from '../components/sidebar.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import ErrorStore from '../stores/error_store.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import SignupTeam from '../components/signup_team.jsx';
import * as Client from '../utils/client.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';
import SignupTeamConfirm from '../components/signup_team_confirm.jsx';
import SignupUserComplete from '../components/signup_user_complete.jsx';
import ShouldVerifyEmail from '../components/should_verify_email.jsx';
import DoVerifyEmail from '../components/do_verify_email.jsx';
import AdminConsole from '../components/admin_console/admin_controller.jsx';
import ClaimAccount from '../components/claim/claim_account.jsx';

import SignupTeamComplete from '../components/signup_team_complete/components/signup_team_complete.jsx';
import WelcomePage from '../components/signup_team_complete/components/team_signup_welcome_page.jsx';
import TeamDisplayNamePage from '../components/signup_team_complete/components/team_signup_display_name_page.jsx';
import TeamURLPage from '../components/signup_team_complete/components/team_signup_url_page.jsx';
import SendInivtesPage from '../components/signup_team_complete/components/team_signup_send_invites_page.jsx';
import UsernamePage from '../components/signup_team_complete/components/team_signup_username_page.jsx';
import PasswordPage from '../components/signup_team_complete/components/team_signup_password_page.jsx';
import FinishedPage from '../components/signup_team_complete/components/team_signup_finished.jsx';

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
    global.window.analytics = {};
    global.window.analytics.page = () => {
        // Do Nothing
    };
    global.window.analytics.track = () => {
        // Do Nothing
    };

    $.when(d1, d2).done(callwhendone);
}

function preLoggedIn(nextState, replace, callback) {
    const d1 = Client.getAllPreferences(
        (data) => {
            if (!data) {
                return;
            }

            PreferenceStore.setPreferences(data);
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getAllPreferences');
        }
    );

    const d2 = AsyncClient.getChannels();

    $.when(d1, d2).done(() => callback());
}

function onChannelChange(nextState) {
    const channelName = nextState.params.channel;

    // Make sure we have all the channels
    AsyncClient.getChannels(true);

    // Get our channel's ID
    const channel = ChannelStore.getByName(channelName);

    // User clicked channel
    GlobalActions.emitChannelClickEvent(channel);
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

function onLoggedOut(nextState) {
    const teamName = nextState.params.team;
    Client.logout(
        () => {
            browserHistory.push('/' + teamName + '/login');
            BrowserStore.signalLogout();
            BrowserStore.clear();
            ErrorStore.clearLastError();
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
                        onEnter={onChannelChange}
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
                            center: ChannelView
                        }}
                    />
                    <Route
                        path=':team/logout'
                        onEnter={onLoggedOut}
                        components={{
                            sidebar: null,
                            center: null
                        }}
                    />
                    <Route
                        path='admin_console'
                        components={{
                            sidebar: null,
                            center: AdminConsole
                        }}
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
                            path='claim'
                            component={ClaimAccount}
                        />
                        <Route
                            path='reset_password'
                            component={PasswordResetSendLink}
                        />
                        <Route
                            path='reset_password_complete'
                            component={PasswordResetForm}
                        />
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
