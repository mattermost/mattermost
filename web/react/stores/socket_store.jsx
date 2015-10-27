// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const UserStore = require('./user_store.jsx');
const PostStore = require('./post_store.jsx');
const ChannelStore = require('./channel_store.jsx');
const BrowserStore = require('./browser_store.jsx');
const ErrorStore = require('./error_store.jsx');
const EventEmitter = require('events').EventEmitter;

const Utils = require('../utils/utils.jsx');
const AsyncClient = require('../utils/async_client.jsx');

const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;
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
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_MSG,
                    msg: JSON.parse(evt.data)
                });
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
    PostStore.storePost(post);

    // Update channel state
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt(true);
        }
    } else if (UserStore.getCurrentId() !== msg.user_id || post.type !== Constants.POST_TYPE_JOIN_LEAVE) {
        AsyncClient.getChannel(msg.channel_id);
    }

    // Send desktop notification
    if (UserStore.getCurrentId() !== msg.user_id) {
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
        if (UserStore.hasProfile(msg.user_id)) {
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

    PostStore.storeUnseenDeletedPost(post);
    PostStore.removePost(post, true);
    PostStore.emitChange();
}

function handleNewUserEvent() {
    AsyncClient.getProfiles();
    AsyncClient.getChannelExtraInfo(true);
}

function handleUserAddedEvent(msg) {
    if (ChannelStore.getCurrentId() === msg.channel_id) {
        AsyncClient.getChannelExtraInfo(true);
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
        AsyncClient.getChannelExtraInfo(true);
    }
}

function handleChannelViewedEvent(msg) {
    // Useful for when multiple devices have the app open to different channels
    if (ChannelStore.getCurrentId() !== msg.channel_id && UserStore.getCurrentId() === msg.user_id) {
        AsyncClient.getChannel(msg.channel_id);
    }
}

var SocketStore = new SocketStoreClass();

SocketStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_MSG:
        SocketStore.handleMessage(action.msg);
        SocketStore.emitChange(action.msg);
        break;

    default:
    }
});

export default SocketStore;
