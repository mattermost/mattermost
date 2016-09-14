// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';

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
import * as UserActions from 'actions/user_actions.jsx';
import {handleNewPost} from 'actions/post_actions.jsx';

import {Constants, SocketEvents, ActionTypes} from 'utils/constants.jsx';

import {browserHistory} from 'react-router/es6';

const MAX_WEBSOCKET_FAILS = 7;

export function initialize() {
    if (window.WebSocket) {
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
        WebSocketClient.setReconnectCallback(handleReconnect);
        WebSocketClient.setCloseCallback(handleClose);
        WebSocketClient.initialize(connUrl);
    }
}

export function close() {
    WebSocketClient.close();
}

export function getStatuses() {
    WebSocketClient.getStatuses(
        (resp) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_STATUSES,
                statuses: resp.data
            });
        }
    );
}

function handleReconnect() {
    if (Client.teamId) {
        AsyncClient.getChannels();
        AsyncClient.getPosts(ChannelStore.getCurrentId());
        AsyncClient.getTeamMembers(TeamStore.getCurrentId());
        AsyncClient.getProfiles();
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
        handleNewUserEvent();
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
}

function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.data.post);
    PostStore.storePost(post);
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

function handleNewUserEvent() {
    AsyncClient.getTeamMembers(TeamStore.getCurrentId());
    AsyncClient.getProfiles();
    AsyncClient.getDirectProfiles();
    AsyncClient.getChannelExtraInfo();
}

function handleLeaveTeamEvent(msg) {
    if (UserStore.getCurrentId() === msg.data.user_id) {
        TeamStore.removeTeamMember(msg.broadcast.team_id);

        // if the are on the team begin removed redirect them to the root
        if (TeamStore.getCurrentId() === msg.broadcast.team_id) {
            TeamStore.setCurrentId('');
            Client.setTeamId('');
            browserHistory.push('/');
        }
    } else if (TeamStore.getCurrentId() === msg.broadcast.team_id) {
        UserActions.getMoreDmList();
    }
}

function handleDirectAddedEvent(msg) {
    AsyncClient.getChannel(msg.broadcast.channel_id);
    AsyncClient.getDirectProfiles();
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.broadcast.channel_id) {
        AsyncClient.getChannelExtraInfo();
    }

    if (TeamStore.getCurrentId() === msg.data.team_id && UserStore.getCurrentId() === msg.data.user_id) {
        AsyncClient.getChannel(msg.broadcast.channel_id);
    }
}

function handleUserRemovedEvent(msg) {
    if (UserStore.getCurrentId() === msg.broadcast.user_id) {
        AsyncClient.getChannels();

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
        AsyncClient.getChannelExtraInfo();
    }
}

function handleUserUpdatedEvent(msg) {
    const user = msg.data.user;
    if (UserStore.getCurrentId() !== user.id) {
        UserStore.saveProfile(user);
        if (UserStore.hasDirectProfile(user.id)) {
            UserStore.saveDirectProfile(user);
        }
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
    AsyncClient.getChannels();
}

function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.data.preference);
    GlobalActions.emitPreferenceChangedEvent(preference);
}

function handleUserTypingEvent(msg) {
    GlobalActions.emitRemoteUserTypingEvent(msg.broadcast.channel_id, msg.data.user_id, msg.data.parent_id);
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