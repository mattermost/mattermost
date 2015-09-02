// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var UserStore = require('./user_store.jsx');
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
            console.log('connecting to ' + connUrl); //eslint-disable-line no-console
            conn = new WebSocket(connUrl);

            conn.onclose = function closeConn(evt) {
                console.log('websocket closed'); //eslint-disable-line no-console
                console.log(evt); //eslint-disable-line no-console
                conn = null;
                setTimeout(
                    function reconnect() {
                        this.initialize();
                    }.bind(this),
                    3000
                );
            }.bind(this);

            conn.onerror = function connError(evt) {
                console.log('websocket error'); //eslint-disable-line no-console
                console.log(evt); //eslint-disable-line no-console
            };

            conn.onmessage = function connMessage(evt) {
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

SocketStore.dispatchToken = AppDispatcher.register(function registry(payload) {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_MSG:
        SocketStore.emitChange(action.msg);
        break;

    default:
    }
});

export default SocketStore;
