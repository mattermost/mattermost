// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var UserStore = require('./user_store.jsx')
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var client = require('../utils/client.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';

var conn;

var SocketStore = assign({}, EventEmitter.prototype, {
    initialize: function() {
        if (!UserStore.getCurrentId()) {
            return;
        }

        var self = this;
        self.setMaxListeners(0);

        if (window.WebSocket && !conn) {
            var protocol = 'ws://';
            if (window.location.protocol === 'https:') {
                protocol = 'wss://';
            }
            var connUrl = protocol + location.host + '/api/v1/websocket';
            console.log('connecting to ' + connUrl);
            conn = new WebSocket(connUrl);

            conn.onclose = function closeConn(evt) {
                console.log('websocket closed');
                console.log(evt);
                conn = null;
                setTimeout(
                    function reconnect() {
                        self.initialize();
                    },
                    3000
                );
            };

            conn.onerror = function connError(evt) {
                console.log('websocket error');
                console.log(evt);
            };

            conn.onmessage = function connMessage(evt) {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_MSG,
                    msg: JSON.parse(evt.data)
                });
            };
        }
    },
    emitChange: function(msg) {
        this.emit(CHANGE_EVENT, msg);
    },
    addChangeListener: function(callback) {
        this.on(CHANGE_EVENT, callback);
    },
    removeChangeListener: function(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    },
    sendMessage: function(msg) {
        if (conn && conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify(msg));
        } else if (!conn || conn.readyState === WebSocket.Closed) {
            conn = null;
            this.initialize();
        }
    }
});

SocketStore.dispatchToken = AppDispatcher.register(function(payload) {
    var action = payload.action;

    switch (action.type) {
        case ActionTypes.RECIEVED_MSG:
        SocketStore.emitChange(action.msg);
        break;

        default:
    }
});

SocketStore.initialize();
module.exports = SocketStore;
