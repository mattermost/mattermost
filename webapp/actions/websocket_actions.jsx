// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import NotificationStore from 'stores/notification_store.jsx'; //eslint-disable-line no-unused-vars

import WebSocketClient from 'client/web_websocket_client.jsx';
import * as WebrtcActions from './webrtc_actions.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {handleNewPost} from 'actions/post_actions.jsx';
import {loadProfilesForSidebar} from 'actions/user_actions.jsx';
import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';
import * as StatusActions from 'actions/status_actions.jsx';

import {Constants, Preferences, SocketEvents, UserStatuses, ErrorBarTypes} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {batchActions} from 'redux-batched-actions';
import {Client4} from 'mattermost-redux/client';
import {getSiteURL} from 'utils/url.jsx';

import * as TeamActions from 'mattermost-redux/actions/teams';
import {viewChannel, getChannelAndMyMember, getChannelStats} from 'mattermost-redux/actions/channels';
import {getPosts, getProfilesAndStatusesForPosts} from 'mattermost-redux/actions/posts';
import {setServerVersion} from 'mattermost-redux/actions/general';
import {ChannelTypes, TeamTypes, UserTypes, PostTypes, EmojiTypes} from 'mattermost-redux/action_types';

const MAX_WEBSOCKET_FAILS = 7;

export function initialize() {
    if (!window.WebSocket) {
        console.log('Browser does not support websocket'); //eslint-disable-line no-console
        return;
    }

    let connUrl = getSiteURL();

    // replace the protocol with a websocket one
    if (connUrl.startsWith('https:')) {
        connUrl = connUrl.replace(/^https:/, 'wss:');
    } else {
        connUrl = connUrl.replace(/^http:/, 'ws:');
    }

    // append a port number if one isn't already specified
    if (!(/:\d+$/).test(connUrl)) {
        if (connUrl.startsWith('wss:')) {
            connUrl += ':' + global.window.mm_config.WebsocketSecurePort;
        } else {
            connUrl += ':' + global.window.mm_config.WebsocketPort;
        }
    }

    connUrl += Client4.getUrlVersion() + '/websocket';

    WebSocketClient.setEventCallback(handleEvent);
    WebSocketClient.setFirstConnectCallback(handleFirstConnect);
    WebSocketClient.setReconnectCallback(() => reconnect(false));
    WebSocketClient.setMissedEventCallback(() => reconnect(false));
    WebSocketClient.setCloseCallback(handleClose);
    WebSocketClient.initialize(connUrl);
}

export function close() {
    WebSocketClient.close();
}

function reconnectWebSocket() {
    close();
    initialize();
}

export function reconnect(includeWebSocket = true) {
    if (includeWebSocket) {
        reconnectWebSocket();
    }

    loadChannelsForCurrentUser();
    getPosts(ChannelStore.getCurrentId())(dispatch, getState);
    StatusActions.loadStatusesForChannelAndSidebar();

    ErrorStore.clearLastError();
    ErrorStore.emitChange();
}

let intervalId = '';
const SYNC_INTERVAL_MILLISECONDS = 1000 * 60 * 15; // 15 minutes

export function startPeriodicSync() {
    clearInterval(intervalId);

    intervalId = setInterval(
        () => {
            if (UserStore.getCurrentUser() != null) {
                reconnect(false);
            }
        },
        SYNC_INTERVAL_MILLISECONDS
    );
}

export function stopPeriodicSync() {
    clearInterval(intervalId);
}

function handleFirstConnect() {
    ErrorStore.clearLastError();
    ErrorStore.emitChange();
}

function handleClose(failCount) {
    if (failCount > MAX_WEBSOCKET_FAILS) {
        ErrorStore.storeLastError({message: ErrorBarTypes.WEBSOCKET_PORT_ERROR});
    }

    ErrorStore.setConnectionErrorCount(failCount);
    ErrorStore.emitChange();
}

function handleEvent(msg) {
    switch (msg.event) {
    case SocketEvents.POSTED:
    case SocketEvents.EPHEMERAL_MESSAGE:
        handleNewPostEvent(msg);
        break;

    case SocketEvents.POST_EDITED:
        handlePostEditEvent(msg);
        break;

    case SocketEvents.POST_DELETED:
        handlePostDeleteEvent(msg);
        break;

    case SocketEvents.LEAVE_TEAM:
        handleLeaveTeamEvent(msg);
        break;

    case SocketEvents.UPDATE_TEAM:
        handleUpdateTeamEvent(msg);
        break;

    case SocketEvents.ADDED_TO_TEAM:
        handleTeamAddedEvent(msg);
        break;

    case SocketEvents.USER_ADDED:
        handleUserAddedEvent(msg);
        break;

    case SocketEvents.USER_REMOVED:
        handleUserRemovedEvent(msg);
        break;

    case SocketEvents.USER_UPDATED:
        handleUserUpdatedEvent(msg);
        break;

    case SocketEvents.MEMBERROLE_UPDATED:
        handleUpdateMemberRoleEvent(msg);
        break;

    case SocketEvents.CHANNEL_CREATED:
        handleChannelCreatedEvent(msg);
        break;

    case SocketEvents.CHANNEL_DELETED:
        handleChannelDeletedEvent(msg);
        break;

    case SocketEvents.CHANNEL_UPDATED:
        handleChannelUpdatedEvent(msg);
        break;

    case SocketEvents.DIRECT_ADDED:
        handleDirectAddedEvent(msg);
        break;

    case SocketEvents.PREFERENCE_CHANGED:
        handlePreferenceChangedEvent(msg);
        break;

    case SocketEvents.PREFERENCES_CHANGED:
        handlePreferencesChangedEvent(msg);
        break;

    case SocketEvents.PREFERENCES_DELETED:
        handlePreferencesDeletedEvent(msg);
        break;

    case SocketEvents.TYPING:
        handleUserTypingEvent(msg);
        break;

    case SocketEvents.STATUS_CHANGED:
        handleStatusChangedEvent(msg);
        break;

    case SocketEvents.HELLO:
        handleHelloEvent(msg);
        break;

    case SocketEvents.WEBRTC:
        handleWebrtc(msg);
        break;

    case SocketEvents.REACTION_ADDED:
        handleReactionAddedEvent(msg);
        break;

    case SocketEvents.REACTION_REMOVED:
        handleReactionRemovedEvent(msg);
        break;

    case SocketEvents.EMOJI_ADDED:
        handleAddEmoji(msg);
        break;

    case SocketEvents.CHANNEL_VIEWED:
        handleChannelViewedEvent(msg);
        break;

    default:
    }
}

function handleChannelUpdatedEvent(msg) {
    const channel = JSON.parse(msg.data.channel);
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL, data: channel});
}

function handleNewPostEvent(msg) {
    const post = JSON.parse(msg.data.post);
    handleNewPost(post, msg);

    getProfilesAndStatusesForPosts([post], dispatch, getState);

    if (post.user_id !== UserStore.getCurrentId()) {
        UserStore.setStatus(post.user_id, UserStatuses.ONLINE);
    }
}

function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.data.post);
    dispatch({type: PostTypes.RECEIVED_POST, data: post});

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        if (window.isActive) {
            viewChannel(ChannelStore.getCurrentId())(dispatch, getState);
        }
    }

    // Needed for search store
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.POST_UPDATED,
        post
    });
}

function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.data.post);
    dispatch({type: PostTypes.POST_DELETED, data: post});

    // Needed for search store
    AppDispatcher.handleViewAction({
        type: Constants.ActionTypes.POST_DELETED,
        post
    });
}

async function handleTeamAddedEvent(msg) {
    await TeamActions.getTeam(msg.data.team_id)(dispatch, getState);
    await TeamActions.getMyTeamMembers()(dispatch, getState);
    await TeamActions.getMyTeamUnreads()(dispatch, getState);
}

function handleLeaveTeamEvent(msg) {
    if (UserStore.getCurrentId() === msg.data.user_id) {
        TeamStore.removeMyTeamMember(msg.data.team_id);

        // if they are on the team being removed redirect them to default team
        if (TeamStore.getCurrentId() === msg.data.team_id) {
            BrowserStore.removeGlobalItem('team');
            BrowserStore.removeGlobalItem(msg.data.team_id);

            if (!global.location.pathname.startsWith('/admin_console')) {
                GlobalActions.redirectUserToDefaultTeam();
            }
        }

        dispatch(batchActions([
            {
                type: UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM,
                data: {user_id: msg.data.user_id},
                id: msg.data.team_id
            },
            {
                type: TeamTypes.REMOVE_MEMBER_FROM_TEAM,
                data: {team_id: msg.data.team_id, user_id: msg.data.user_id}
            }
        ]));
    } else {
        UserStore.removeProfileFromTeam(msg.data.team_id, msg.data.user_id);
        TeamStore.removeMemberInTeam(msg.data.team_id, msg.data.user_id);
    }
}

function handleUpdateTeamEvent(msg) {
    TeamStore.updateTeam(msg.data.team);
}

function handleUpdateMemberRoleEvent(msg) {
    const member = JSON.parse(msg.data.member);
    TeamStore.updateMyRoles(member);
}

function handleDirectAddedEvent(msg) {
    getChannelAndMyMember(msg.broadcast.channel_id)(dispatch, getState);
    PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, msg.data.teammate_id, 'true');
    loadProfilesForSidebar();
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        getChannelStats(ChannelStore.getCurrentId())(dispatch, getState);
    }

    if (TeamStore.getCurrentId() === msg.data.team_id && UserStore.getCurrentId() === msg.data.user_id) {
        getChannelAndMyMember(msg.broadcast.channel_id)(dispatch, getState);
    }
}

function handleUserRemovedEvent(msg) {
    if (UserStore.getCurrentId() === msg.broadcast.user_id) {
        loadChannelsForCurrentUser();

        if (msg.data.remover_id !== msg.broadcast.user_id &&
                msg.data.channel_id === ChannelStore.getCurrentId() &&
                $('#removed_from_channel').length > 0) {
            var sentState = {};
            sentState.channelName = ChannelStore.getCurrent().display_name;
            sentState.remover = UserStore.getProfile(msg.data.remover_id).username;

            BrowserStore.setItem('channel-removed-state', sentState);
            $('#removed_from_channel').modal('show');
        }

        GlobalActions.toggleSideBarAction(false);

        const townsquare = ChannelStore.getByName('town-square');
        browserHistory.push(TeamStore.getCurrentTeamRelativeUrl() + '/channels/' + townsquare.name);

        dispatch({
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {id: msg.data.channel_id, user_id: msg.broadcast.user_id}
        });
    } else if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        getChannelStats(ChannelStore.getCurrentId())(dispatch, getState);
    }
}

function handleUserUpdatedEvent(msg) {
    const user = msg.data.user;
    if (UserStore.getCurrentId() !== user.id) {
        UserStore.saveProfile(user);
    }
}

function handleChannelCreatedEvent(msg) {
    const channelId = msg.data.channel_id;
    const teamId = msg.data.team_id;

    if (TeamStore.getCurrentId() === teamId && !ChannelStore.getChannelById(channelId)) {
        getChannelAndMyMember(channelId)(dispatch, getState);
    }
}

function handleChannelDeletedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.data.channel_id) {
        const teamUrl = TeamStore.getCurrentTeamRelativeUrl();
        browserHistory.push(teamUrl + '/channels/' + Constants.DEFAULT_CHANNEL);
    }
    dispatch({type: ChannelTypes.RECEIVED_CHANNEL_DELETED, data: {id: msg.data.channel_id, team_id: msg.broadcast.team_id}}, getState);
    loadChannelsForCurrentUser();
}

function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.data.preference);
    GlobalActions.emitPreferenceChangedEvent(preference);
}

function handlePreferencesChangedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    GlobalActions.emitPreferencesChangedEvent(preferences);
}

function handlePreferencesDeletedEvent(msg) {
    const preferences = JSON.parse(msg.data.preferences);
    GlobalActions.emitPreferencesDeletedEvent(preferences);
}

function handleUserTypingEvent(msg) {
    GlobalActions.emitRemoteUserTypingEvent(msg.broadcast.channel_id, msg.data.user_id, msg.data.parent_id);

    if (msg.data.user_id !== UserStore.getCurrentId()) {
        UserStore.setStatus(msg.data.user_id, UserStatuses.ONLINE);
    }
}

function handleStatusChangedEvent(msg) {
    UserStore.setStatus(msg.data.user_id, msg.data.status);
}

function handleHelloEvent(msg) {
    setServerVersion(msg.data.server_version)(dispatch, getState);
}

function handleWebrtc(msg) {
    const data = msg.data;
    return WebrtcActions.handle(data);
}

function handleReactionAddedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    dispatch({
        type: PostTypes.RECEIVED_REACTION,
        data: reaction
    });
}

function handleAddEmoji(msg) {
    const data = JSON.parse(msg.data.emoji);

    dispatch({
        type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
        data
    });
}

function handleReactionRemovedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    dispatch({
        type: PostTypes.REACTION_DELETED,
        data: reaction
    });
}

function handleChannelViewedEvent(msg) {
// Useful for when multiple devices have the app open to different channels
    if (ChannelStore.getCurrentId() !== msg.data.channel_id &&
        UserStore.getCurrentId() === msg.broadcast.user_id) {
        // Mark previous and next channel as read
        ChannelStore.resetCounts([msg.data.channel_id]);
    }
}
