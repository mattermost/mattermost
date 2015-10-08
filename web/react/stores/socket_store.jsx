// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var UserStore = require('./user_store.jsx');
var ErrorStore = require('./error_store.jsx');
var EventEmitter = require('events').EventEmitter;

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';

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

        this.setMaxListeners(0);

        if (window.WebSocket && !conn) {
            var protocol = 'ws://';
            if (window.location.protocol === 'https:') {
                protocol = 'wss://';
            }
            var connUrl = protocol + location.host + '/api/v1/websocket';
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

                ErrorStore.storeLastError({connErrorCount: this.failCount, message: 'We cannot reach the Mattermost service.  The service may be down or misconfigured.  Please contact an administrator to make sure the WebSocket port is configured properly.'});
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
    sendMessage(msg) {
        if (conn && conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify(msg));
        } else if (!conn || conn.readyState === WebSocket.Closed) {
            conn = null;
            this.initialize();
        }
    }
}

var SocketStore = new SocketStoreClass();

SocketStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_MSG:
        SocketStore.emitChange(action.msg);
        break;

    default:
    }
});

export default SocketStore;
