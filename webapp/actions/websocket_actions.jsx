// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import UserStore from 'stores/user_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import NotificationStore from 'stores/notification_store.jsx'; //eslint-disable-line no-unused-vars

import Client from 'client/web_client.jsx';
import WebSocketClient from 'client/web_websocket_client.jsx';
import * as WebrtcActions from './webrtc_actions.jsx';
import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {handleNewPost, loadPosts} from 'actions/post_actions.jsx';
import {loadProfilesAndTeamMembersForDMSidebar} from 'actions/user_actions.jsx';
import {loadChannelsForCurrentUser} from 'actions/channel_actions.jsx';
import * as StatusActions from 'actions/status_actions.jsx';

import {Constants, SocketEvents, UserStatuses} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

const MAX_WEBSOCKET_FAILS = 7;

export function initialize() {
    if (!window.WebSocket) {
        console.log('Browser does not support websocket'); //eslint-disable-line no-console
        return;
    }

    let connUrl = Utils.getSiteURL();

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
    WebSocketClient.setReconnectCallback(handleReconnect);
    WebSocketClient.setCloseCallback(handleClose);
    WebSocketClient.initialize(connUrl);
}

export function close() {
    WebSocketClient.close();
}

export function getStatuses() {
    StatusActions.loadStatusesForChannelAndSidebar();
}

function handleFirstConnect() {
    getStatuses();
    ErrorStore.clearLastError();
    ErrorStore.emitChange();
}

function handleReconnect() {
    if (Client.teamId) {
        loadChannelsForCurrentUser();
        loadPosts(ChannelStore.getCurrentId());
    }

    getStatuses();
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

    case SocketEvents.NEW_USER:
        handleNewUserEvent(msg);
        break;

    case SocketEvents.LEAVE_TEAM:
        handleLeaveTeamEvent(msg);
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

    case SocketEvents.CHANNEL_VIEWED:
        handleChannelViewedEvent(msg);
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

    default:
    }
}

function handleNewPostEvent(msg) {
    const post = JSON.parse(msg.data.post);
    handleNewPost(post, msg);

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
            AsyncClient.updateLastViewedAt(null, false);
        }
    }
}

function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.data.post);
    GlobalActions.emitPostDeletedEvent(post);

    const selectedPostId = PostStore.getSelectedPostId();
    if (selectedPostId === post.id) {
        GlobalActions.emitCloseRightHandSide();
    }
}

function handleNewUserEvent(msg) {
    if (TeamStore.getCurrentId() === '') {
        // Any new users will be loaded when we switch into a context with a team
        return;
    }

    AsyncClient.getUser(msg.data.user_id);
    AsyncClient.getChannelStats();
    loadProfilesAndTeamMembersForDMSidebar();
}

function handleLeaveTeamEvent(msg) {
    if (UserStore.getCurrentId() === msg.data.user_id) {
        TeamStore.removeMyTeamMember(msg.data.team_id);

        // if they are on the team being removed redirect them to the root
        if (TeamStore.getCurrentId() === msg.data.team_id) {
            TeamStore.setCurrentId('');
            Client.setTeamId('');
            browserHistory.push('/');
        }
    }
}

function handleDirectAddedEvent(msg) {
    AsyncClient.getChannel(msg.broadcast.channel_id);
    loadProfilesAndTeamMembersForDMSidebar();
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

function handleChannelViewedEvent(msg) {
    // Useful for when multiple devices have the app open to different channels
    if (TeamStore.getCurrentId() === msg.broadcast.team_id &&
            ChannelStore.getCurrentId() !== msg.data.channel_id &&
            UserStore.getCurrentId() === msg.broadcast.user_id) {
        AsyncClient.getChannel(msg.data.channel_id);
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
