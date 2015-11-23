// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from './user_store.jsx';
import PostStore from './post_store.jsx';
import ChannelStore from './channel_store.jsx';
import BrowserStore from './browser_store.jsx';
import ErrorStore from './error_store.jsx';
import EventEmitter from 'events';

import * as Utils from '../utils/utils.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import Constants from '../utils/constants.jsx';
const SocketEvents = Constants.SocketEvents;

const CHANGE_EVENT = 'change';

var conn;

class SocketStoreClass extends EventEmitter {
    constructor() {
        super();

        this.initialize = this.initialize.bind(this);
        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.failCount = 0;

        this.initialize();
    }
    initialize() {
        if (!UserStore.getCurrentId()) {
            return;
        }

        if (!global.window.hasOwnProperty('mm_session_token_index')) {
            return;
        }

        this.setMaxListeners(0);

        if (window.WebSocket && !conn) {
            var protocol = 'ws://';
            if (window.location.protocol === 'https:') {
                protocol = 'wss://';
            }

            var connUrl = protocol + location.host + '/api/v1/websocket?' + Utils.getSessionIndex();

            if (this.failCount === 0) {
                console.log('websocket connecting to ' + connUrl); //eslint-disable-line no-console
            }
            conn = new WebSocket(connUrl);

            conn.onopen = () => {
                if (this.failCount > 0) {
                    console.log('websocket re-established connection'); //eslint-disable-line no-console
                }

                this.failCount = 0;
                if (ErrorStore.getLastError()) {
                    ErrorStore.storeLastError(null);
                    ErrorStore.emitChange();
                }
            };

            conn.onclose = () => {
                conn = null;
                setTimeout(
                    () => {
                        this.initialize();
                    },
                    3000
                );
            };

            conn.onerror = (evt) => {
                if (this.failCount === 0) {
                    console.log('websocket error ' + evt); //eslint-disable-line no-console
                }

                this.failCount = this.failCount + 1;

                ErrorStore.storeLastError({connErrorCount: this.failCount, message: 'Please check connection, Mattermost unreachable. If issue persists, ask administrator to check WebSocket port.'});
                ErrorStore.emitChange();
            };

            conn.onmessage = (evt) => {
                const msg = JSON.parse(evt.data);
                this.handleMessage(msg);
                this.emitChange(msg);
            };
        }
    }
    emitChange(msg) {
        this.emit(CHANGE_EVENT, msg);
    }
    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }
    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }
    handleMessage(msg) {
        switch (msg.action) {
        case SocketEvents.POSTED:
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

        default:
        }
    }
    sendMessage(msg) {
        if (conn && conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify(msg));
        } else if (!conn || conn.readyState === WebSocket.Closed) {
            conn = null;
            this.initialize();
        }
    }
}

function handleNewPostEvent(msg) {
    // Store post
    const post = JSON.parse(msg.props.post);
    EventHelpers.emitPostRecievedEvent(post);

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt();
        }
    } else if (UserStore.getCurrentId() !== msg.user_id || post.type !== Constants.POST_TYPE_JOIN_LEAVE) {
        AsyncClient.getChannel(msg.channel_id);
    }

    // Send desktop notification
    if (UserStore.getCurrentId() !== msg.user_id || post.props.from_webhook === 'true') {
        const msgProps = msg.props;

        let mentions = [];
        if (msgProps.mentions) {
            mentions = JSON.parse(msg.props.mentions);
        }

        const channel = ChannelStore.get(msg.channel_id);
        const user = UserStore.getCurrentUser();
        const member = ChannelStore.getMember(msg.channel_id);

        let notifyLevel = member && member.notify_props ? member.notify_props.desktop : 'default';
        if (notifyLevel === 'default') {
            notifyLevel = user.notify_props.desktop;
        }

        if (notifyLevel === 'none') {
            return;
        } else if (notifyLevel === 'mention' && mentions.indexOf(user.id) === -1 && channel.type !== 'D') {
            return;
        }

        let username = 'Someone';
        if (post.props.override_username && global.window.mm_config.EnablePostUsernameOverride === 'true') {
            username = post.props.override_username;
        } else if (UserStore.hasProfile(msg.user_id)) {
            username = UserStore.getProfile(msg.user_id).username;
        }

        let title = 'Posted';
        if (channel) {
            title = channel.display_name;
        }

        let notifyText = post.message.replace(/\n+/g, ' ');
        if (notifyText.length > 50) {
            notifyText = notifyText.substring(0, 49) + '...';
        }

        if (notifyText.length === 0) {
            if (msgProps.image) {
                Utils.notifyMe(title, username + ' uploaded an image', channel);
            } else if (msgProps.otherFile) {
                Utils.notifyMe(title, username + ' uploaded a file', channel);
            } else {
                Utils.notifyMe(title, username + ' did something new', channel);
            }
        } else {
            Utils.notifyMe(title, username + ' wrote: ' + notifyText, channel);
        }
        if (!user.notify_props || user.notify_props.desktop_sound === 'true') {
            Utils.ding();
        }
    }
}

function handlePostEditEvent(msg) {
    // Store post
    const post = JSON.parse(msg.props.post);
    PostStore.storePost(post);

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt();
        }
    }
}

function handlePostDeleteEvent(msg) {
    const post = JSON.parse(msg.props.post);
    EventHelpers.emitPostDeletedEvent(post);
}

function handleNewUserEvent() {
    AsyncClient.getProfiles();
    AsyncClient.getChannelExtraInfo();
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        AsyncClient.getChannelExtraInfo();
    }

    if (UserStore.getCurrentId() === msg.user_id) {
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
    if (ChannelStore.getCurrentId() !== msg.channel_id && UserStore.getCurrentId() === msg.user_id) {
        AsyncClient.getChannel(msg.channel_id);
    }
}

var SocketStore = new SocketStoreClass();

/*SocketStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    default:
    }
    });*/

export default SocketStore;
