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

import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';

import Constants from 'utils/constants.jsx';
const SocketEvents = Constants.SocketEvents;

const MAX_WEBSOCKET_FAILS = 7;
const WEBSOCKET_RETRY_TIME = 3000;

var conn = null;
var connectFailCount = 0;
var pastFirstInit = false;
var manuallyClosed = false;

export function initialize() {
    if (window.WebSocket && !conn) {
        let protocol = 'ws://';
        if (window.location.protocol === 'https:') {
            protocol = 'wss://';
        }

        const connUrl = protocol + location.host + ((/:\d+/).test(location.host) ? '' : Utils.getWebsocketPort(protocol)) + Client.getUsersRoute() + '/websocket';

        if (connectFailCount === 0) {
            console.log('websocket connecting to ' + connUrl); //eslint-disable-line no-console
        }

        manuallyClosed = false;

        conn = new WebSocket(connUrl);

        conn.onopen = () => {
            if (connectFailCount > 0) {
                console.log('websocket re-established connection'); //eslint-disable-line no-console
                AsyncClient.getChannels();
                AsyncClient.getPosts(ChannelStore.getCurrentId());
            }

            if (pastFirstInit) {
                ErrorStore.clearLastError();
                ErrorStore.emitChange();
            }

            pastFirstInit = true;
            connectFailCount = 0;
        };

        conn.onclose = () => {
            conn = null;

            if (connectFailCount === 0) {
                console.log('websocket closed'); //eslint-disable-line no-console
            }

            connectFailCount = connectFailCount + 1;

            if (connectFailCount > MAX_WEBSOCKET_FAILS) {
                ErrorStore.storeLastError({message: Utils.localizeMessage('channel_loader.socketError', 'Please check connection, Mattermost unreachable. If issue persists, ask administrator to check WebSocket port.')});
            }

            ErrorStore.setConnectionErrorCount(connectFailCount);
            ErrorStore.emitChange();

            if (!manuallyClosed) {
                setTimeout(
                    () => {
                        initialize();
                    },
                    WEBSOCKET_RETRY_TIME
                );
            }
        };

        conn.onerror = (evt) => {
            if (connectFailCount <= 1) {
                console.log('websocket error'); //eslint-disable-line no-console
                console.log(evt); //eslint-disable-line no-console
            }
        };

        conn.onmessage = (evt) => {
            const msg = JSON.parse(evt.data);
            handleMessage(msg);
        };
    }
}

function handleMessage(msg) {
    // Let the store know we are online. This probably shouldn't be here.
    UserStore.setStatus(msg.user_id, 'online');

    switch (msg.action) {
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

    case SocketEvents.USER_ADDED:
        handleUserAddedEvent(msg);
        break;

    case SocketEvents.USER_REMOVED:
        handleUserRemovedEvent(msg);
        break;

    case SocketEvents.CHANNEL_VIEWED:
        handleChannelViewedEvent(msg);
        break;

    case SocketEvents.PREFERENCE_CHANGED:
        handlePreferenceChangedEvent(msg);
        break;

    case SocketEvents.TYPING:
        handleUserTypingEvent(msg);
        break;

    default:
    }
}

export function sendMessage(msg) {
    if (conn && conn.readyState === WebSocket.OPEN) {
        var teamId = TeamStore.getCurrentId();
        if (teamId && teamId.length > 0) {
            msg.team_id = teamId;
        }

        conn.send(JSON.stringify(msg));
    } else if (!conn || conn.readyState === WebSocket.Closed) {
        conn = null;
        initialize();
    }
}

export function close() {
    manuallyClosed = true;
    if (conn && conn.readyState === WebSocket.OPEN) {
        conn.close();
    }
}

function handleNewPostEvent(msg) {
    const post = JSON.parse(msg.props.post);
    GlobalActions.emitPostRecievedEvent(post, msg);
}

function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.props.post);
    PostStore.storePost(post);
    PostStore.emitChange();

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt();
        }
    }
}

function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.props.post);
    GlobalActions.emitPostDeletedEvent(post);
}

function handleNewUserEvent() {
    AsyncClient.getProfiles();
    AsyncClient.getChannelExtraInfo();
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        AsyncClient.getChannelExtraInfo();
    }

    if (TeamStore.getCurrentId() === msg.team_id && UserStore.getCurrentId() === msg.user_id) {
        AsyncClient.getChannel(msg.channel_id);
    }
}

function handleUserRemovedEvent(msg) {
    if (UserStore.getCurrentId() === msg.user_id) {
        AsyncClient.getChannels();

        if (msg.props.remover_id !== msg.user_id &&
                msg.channel_id === ChannelStore.getCurrentId() &&
                $('#removed_from_channel').length > 0) {
            var sentState = {};
            sentState.channelName = ChannelStore.getCurrent().display_name;
            sentState.remover = UserStore.getProfile(msg.props.remover_id).username;

            BrowserStore.setItem('channel-removed-state', sentState);
            $('#removed_from_channel').modal('show');
        }
    } else if (ChannelStore.getCurrentId() === msg.channel_id) {
        AsyncClient.getChannelExtraInfo();
    }
}

function handleChannelViewedEvent(msg) {
    // Useful for when multiple devices have the app open to different channels
    if (TeamStore.getCurrentId() === msg.team_id && ChannelStore.getCurrentId() !== msg.channel_id && UserStore.getCurrentId() === msg.user_id) {
        AsyncClient.getChannel(msg.channel_id);
    }
}

function handlePreferenceChangedEvent(msg) {
    const preference = JSON.parse(msg.props.preference);
    GlobalActions.emitPreferenceChangedEvent(preference);
}

function handleUserTypingEvent(msg) {
    if (TeamStore.getCurrentId() === msg.team_id) {
        GlobalActions.emitRemoteUserTypingEvent(msg.channel_id, msg.user_id, msg.props.parent_id);
    }
}
