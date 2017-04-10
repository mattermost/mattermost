// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PostStore from 'stores/post_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import NotificationStore from 'stores/notification_store.jsx'; //eslint-disable-line no-unused-vars

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Client from 'client/web_client.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';
import * as WebrtcActions from './webrtc_actions.jsx';
import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import {getSiteURL} from 'utils/url.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {handleNewPost, loadPosts, loadProfilesForPosts} from 'actions/post_actions.jsx';
import {loadProfilesForSidebar} from 'actions/user_actions.jsx';
import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';
import * as StatusActions from 'actions/status_actions.jsx';

import {ActionTypes, Constants, Preferences, SocketEvents, UserStatuses} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

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

    // append the websocket api path
    connUrl += Client.getUsersRoute() + '/websocket';

    WebSocketClient.setEventCallback(handleEvent);
    WebSocketClient.setFirstConnectCallback(handleFirstConnect);
    WebSocketClient.setReconnectCallback(() => reconnect(false));
    WebSocketClient.setMissedEventCallback(() => {
        if (global.window.mm_config.EnableDeveloper === 'true') {
            Client.logClientError('missed websocket event seq=' + WebSocketClient.eventSequence);
        }
        reconnect(false);
    });
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

    if (Client.teamId) {
        loadChannelsForCurrentUser();
        loadPosts(ChannelStore.getCurrentId());
        StatusActions.loadStatusesForChannelAndSidebar();
    }

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
        ErrorStore.storeLastError({message: Utils.localizeMessage('channel_loader.socketError', 'Please check connection, Mattermost unreachable. If issue persists, ask administrator to check WebSocket port.')});
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

    case SocketEvents.CHANNEL_CREATED:
        handleChannelCreatedEvent(msg);
        break;

    case SocketEvents.CHANNEL_DELETED:
        handleChannelDeletedEvent(msg);
        break;

    case SocketEvents.DIRECT_ADDED:
        handleDirectAddedEvent(msg);
        break;

    case SocketEvents.PREFERENCE_CHANGED:
        handlePreferenceChangedEvent(msg);
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

    default:
    }
}

function handleNewPostEvent(msg) {
    const post = JSON.parse(msg.data.post);
    handleNewPost(post, msg);

    const posts = {};
    posts[post.id] = post;
    loadProfilesForPosts(posts);

    if (UserStore.getStatus(post.user_id) !== UserStatuses.ONLINE) {
        StatusActions.loadStatusesByIds([post.user_id]);
    }
}

function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.data.post);
    PostStore.storePost(post, false);
    PostStore.emitChange();

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        if (window.isActive) {
            AsyncClient.viewChannel();
        }
    }
}

function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.data.post);
    GlobalActions.emitPostDeletedEvent(post);
}

function handleTeamAddedEvent(msg) {
    Client.getTeam(msg.data.team_id, (team) => {
        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_TEAM,
            team
        });

        Client.getMyTeamMembers((data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_MY_TEAM_MEMBERS,
                team_members: data
            });
            AsyncClient.getMyTeamsUnread();
        }, (err) => {
            AsyncClient.dispatchError(err, 'getMyTeamMembers');
        });
    }, (err) => {
        AsyncClient.dispatchError(err, 'getTeam');
    });
}

function handleLeaveTeamEvent(msg) {
    if (UserStore.getCurrentId() === msg.data.user_id) {
        TeamStore.removeMyTeamMember(msg.data.team_id);

        // if they are on the team being removed redirect them to default team
        if (TeamStore.getCurrentId() === msg.data.team_id) {
            TeamStore.setCurrentId('');
            Client.setTeamId('');
            BrowserStore.removeGlobalItem('team');
            BrowserStore.removeGlobalItem(msg.data.team_id);

            if (!global.location.pathname.startsWith('/admin_console')) {
                GlobalActions.redirectUserToDefaultTeam();
            }
        }
    } else {
        UserStore.removeProfileFromTeam(msg.data.team_id, msg.data.user_id);
        TeamStore.removeMemberInTeam(msg.data.team_id, msg.data.user_id);
    }
}

function handleUpdateTeamEvent(msg) {
    TeamStore.updateTeam(msg.data.team);
}

function handleDirectAddedEvent(msg) {
    AsyncClient.getChannel(msg.broadcast.channel_id);
    PreferenceStore.setPreference(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, msg.data.teammate_id, 'true');
    loadProfilesForSidebar();
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        AsyncClient.getChannelStats();
    }

    if (TeamStore.getCurrentId() === msg.data.team_id && UserStore.getCurrentId() === msg.data.user_id) {
        AsyncClient.getChannel(msg.broadcast.channel_id);
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
    } else if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        AsyncClient.getChannelStats();
    }
}

function handleUserUpdatedEvent(msg) {
    const user = msg.data.user;
    if (UserStore.getCurrentId() !== user.id) {
        UserStore.saveProfile(user);
        UserStore.emitChange(user.id);
    }
}

function handleChannelCreatedEvent(msg) {
    const channelId = msg.data.channel_id;
    const teamId = msg.data.team_id;

    if (TeamStore.getCurrentId() === teamId && !ChannelStore.getChannelById(channelId)) {
        AsyncClient.getChannel(channelId);
    }
}

function handleChannelDeletedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.data.channel_id) {
        const teamUrl = TeamStore.getCurrentTeamRelativeUrl();
        browserHistory.push(teamUrl + '/channels/' + Constants.DEFAULT_CHANNEL);
    }
    loadChannelsForCurrentUser();
}

function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.data.preference);
    GlobalActions.emitPreferenceChangedEvent(preference);
}

function handleUserTypingEvent(msg) {
    GlobalActions.emitRemoteUserTypingEvent(msg.broadcast.channel_id, msg.data.user_id, msg.data.parent_id);

    if (UserStore.getStatus(msg.data.user_id) !== UserStatuses.ONLINE) {
        StatusActions.loadStatusesByIds([msg.data.user_id]);
    }
}

function handleStatusChangedEvent(msg) {
    UserStore.setStatus(msg.data.user_id, msg.data.status);
}

function handleHelloEvent(msg) {
    Client.serverVersion = msg.data.server_version;
    AsyncClient.checkVersion();
}

function handleWebrtc(msg) {
    const data = msg.data;
    return WebrtcActions.handle(data);
}

function handleReactionAddedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    AppDispatcher.handleServerAction({
        type: ActionTypes.ADDED_REACTION,
        postId: reaction.post_id,
        reaction
    });
}

function handleReactionRemovedEvent(msg) {
    const reaction = JSON.parse(msg.data.reaction);

    AppDispatcher.handleServerAction({
        type: ActionTypes.REMOVED_REACTION,
        postId: reaction.post_id,
        reaction
    });
}
