// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as RouteUtils from 'routes/route_utils.jsx';
import {browserHistory} from 'react-router/es6';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import {loadStatusesForChannelAndSidebar} from 'actions/status_actions.jsx';
import {openDirectChannelToUser} from 'actions/channel_actions.jsx';
import {reconnect} from 'actions/websocket_actions.jsx';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import * as Utils from 'utils/utils.jsx';

import emojiRoute from 'routes/route_emoji.jsx';
import integrationsRoute from 'routes/route_integrations.jsx';

import {loadNewDMIfNeeded, loadNewGMIfNeeded, loadProfilesForSidebar} from 'actions/user_actions.jsx';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {fetchMyChannelsAndMembers, joinChannel} from 'mattermost-redux/actions/channels';
import {getMyTeamUnreads} from 'mattermost-redux/actions/teams';
import {getUser, getUserByUsername, getUserByEmail} from 'mattermost-redux/actions/users';

function onChannelEnter(nextState, replace, callback) {
    doChannelChange(nextState, replace, callback);
}

function doChannelChange(state, replace, callback) {
    let channel;
    if (state.location.query.fakechannel) {
        channel = JSON.parse(state.location.query.fakechannel);
    } else {
        channel = ChannelStore.getByName(state.params.channel);

        if (channel && channel.type === Constants.DM_CHANNEL) {
            loadNewDMIfNeeded(channel.id);
        } else if (channel && channel.type === Constants.GM_CHANNEL) {
            loadNewGMIfNeeded(channel.id);
        }

        if (!channel) {
            joinChannel(UserStore.getCurrentId(), TeamStore.getCurrentId(), null, state.params.channel)(dispatch, getState).then(
                (result) => {
                    if (result.data) {
                        GlobalActions.emitChannelClickEvent(result.data.channel);
                    } else if (result.error) {
                        if (state.params.team) {
                            replace('/' + state.params.team + '/channels/town-square');
                        } else {
                            replace('/');
                        }
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

let wakeUpInterval;
let lastTime = (new Date()).getTime();
const WAKEUP_CHECK_INTERVAL = 30000; // 30 seconds
const WAKEUP_THRESHOLD = 60000; // 60 seconds

function preNeedsTeam(nextState, replace, callback) {
    if (RouteUtils.checkIfMFARequired(nextState)) {
        browserHistory.push('/mfa/setup');
        return;
    }

    clearInterval(wakeUpInterval);

    wakeUpInterval = setInterval(() => {
        const currentTime = (new Date()).getTime();
        if (currentTime > (lastTime + WAKEUP_THRESHOLD)) {  // ignore small delays
            console.log('computer woke up - fetching latest'); //eslint-disable-line no-console
            reconnect(false);
        }
        lastTime = currentTime;
    }, WAKEUP_CHECK_INTERVAL);

    // First check to make sure you're in the current team
    // for the current url.
    const teamName = nextState.params.team;
    const team = TeamStore.getByName(teamName);

    if (!team) {
        browserHistory.push('/?redirect_to=' + encodeURIComponent(nextState.location.pathname));
        return;
    }

    // If current team is set, then this is not first load
    // The first load action pulls team unreads
    if (TeamStore.getCurrentId()) {
        getMyTeamUnreads()(dispatch, getState);
    }

    TeamStore.saveMyTeam(team);
    BrowserStore.setGlobalItem('team', team.id);
    TeamStore.emitChange();
    GlobalActions.emitCloseRightHandSide();

    const d1 = $.Deferred(); //eslint-disable-line new-cap

    fetchMyChannelsAndMembers(team.id)(dispatch, getState).then(
        () => {
            loadStatusesForChannelAndSidebar();
            loadProfilesForSidebar();

            d1.resolve();
        }
    );

    $.when(d1).done(() => {
        callback();
    });
}

function selectLastChannel(nextState, replace, callback) {
    const team = TeamStore.getByName(nextState.params.team);
    const channelId = BrowserStore.getGlobalItem(team.id);
    const channel = ChannelStore.getChannelById(channelId);

    let channelName = 'town-square';
    if (channel) {
        channelName = channel.name;
    }

    replace(`/${team.name}/channels/${channelName}`);
    callback();
}

function onPermalinkEnter(nextState, replace, callback) {
    const postId = nextState.params.postid;
    GlobalActions.emitPostFocusEvent(
        postId,
        () => callback()
    );
}

/**
* identifier may either be:
* - A DM user_id length 26 chars
* - A DM channel_id (id1_id2) length 54 chars
* - A GM generated_id length 40 chars
* - A username that starts with an @ sign
* - An email containing an @ sign
**/
function onChannelByIdentifierEnter(state, replace, callback) {
    const {identifier} = state.params;
    if (identifier.indexOf('@') === -1) {
        // DM user_id or id1_id2 identifier
        if (identifier.length === 26 || identifier.length === 54) {
            const userId = (identifier.length === 26) ? identifier : Utils.getUserIdFromChannelId(identifier);
            const teammate = UserStore.getProfile(userId);
            if (teammate) {
                replace(`/${state.params.team}/messages/@${teammate.username}`);
                callback();
            } else {
                getUser(userId)(dispatch, getState).then(
                    (profile) => {
                        if (profile) {
                            replace(`/${state.params.team}/messages/@${profile.username}`);
                            callback();
                        } else if (profile == null) {
                            handleError(state, replace, callback);
                        }
                    }
                );
            }

        // GM generated_id identifier
        } else if (identifier.length === 40) {
            const channel = ChannelStore.getByName(identifier);
            if (channel) {
                loadNewGMIfNeeded(channel.id);
                GlobalActions.emitChannelClickEvent(channel);
                callback();
            } else {
                joinChannel(UserStore.getCurrentId(), TeamStore.getCurrentId(), null, identifier)(dispatch, getState).then(
                    (result) => {
                        if (result.data) {
                            GlobalActions.emitChannelClickEvent(result.data.channel);
                            callback();
                        } else if (result.error) {
                            handleError(state, replace, callback);
                        }
                    }
                );
            }
        } else {
            handleError(state, replace, callback);
        }
    } else {
        function success(profile) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_PROFILE,
                profile
            });
            directChannelToUser(profile, state, replace, callback);
        }

        function error() {
            handleError(state, replace, callback);
        }

        if (identifier.indexOf('@') === 0) { // @username identifier
            const username = identifier.slice(1, identifier.length);
            const teammate = UserStore.getProfileByUsername(username);
            if (teammate) {
                directChannelToUser(teammate, state, replace, callback);
            } else {
                getUserByUsername(username)(dispatch, getState).then(
                    (data) => {
                        if (data && success) {
                            success(data);
                        } else if (data == null && error) {
                            const serverError = getState().requests.users.getUserByUsername.error;
                            error({id: serverError.server_error_id, ...serverError});
                        }
                    }
                );
            }
        } else if (identifier.indexOf('@') > 0) { // email identifier
            const email = identifier;
            const teammate = UserStore.getProfileByEmail(email);
            if (teammate) {
                directChannelToUser(teammate, state, replace, callback);
            } else {
                getUserByEmail(email)(dispatch, getState).then(
                    (data) => {
                        if (data && success) {
                            success(data);
                        } else if (data == null && error) {
                            const serverError = getState().requests.users.getUser.error;
                            error({id: serverError.server_error_id, ...serverError});
                        }
                    }
                );
            }
        }
    }
}

function directChannelToUser(profile, state, replace, callback) {
    openDirectChannelToUser(
        profile.id,
        (channel) => {
            GlobalActions.emitChannelClickEvent(channel);
            callback();
        },
        () => {
            handleError(state, replace, callback);
        }
    );
}

function handleError(state, replace, callback) {
    if (state.params.team) {
        replace(`/${state.params.team}/channels/${Constants.DEFAULT_CHANNEL}`);
    } else {
        replace('/');
    }
    callback();
}

export default {
    path: ':team',
    onEnter: preNeedsTeam,
    indexRoute: {onEnter: selectLastChannel},
    childRoutes: [
        integrationsRoute,
        emojiRoute,
        {
            getComponents: (location, callback) => {
                System.import('components/needs_team').then(RouteUtils.importComponentSuccess(callback));
            },
            childRoutes: [
                {
                    path: 'channels/:channel',
                    onEnter: onChannelEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/channel_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                },
                {
                    path: 'pl/:postid',
                    onEnter: onPermalinkEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/permalink_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                },
                {
                    path: 'messages/:identifier',
                    onEnter: onChannelByIdentifierEnter,
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/channel_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                },
                {
                    path: 'tutorial',
                    getComponents: (location, callback) => {
                        Promise.all([
                            System.import('components/team_sidebar'),
                            System.import('components/sidebar.jsx'),
                            System.import('components/tutorial/tutorial_view.jsx')
                        ]).then(
                        (comarr) => callback(null, {team_sidebar: comarr[0].default, sidebar: comarr[1].default, center: comarr[2].default})
                        );
                    }
                }
            ]
        }
    ]
};
