// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var UserStore = require('./user_store.jsx')
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var client = require('../utils/client.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var BrowserStore = require('../stores/browser_store.jsx');

var CHANGE_EVENT = 'change';

var conn;

var SocketStore = assign({}, EventEmitter.prototype, {
  initialize: function(self) {
    if (!UserStore.getCurrentId()) return;

    if (!self) self = this;
    self.setMaxListeners(0);

    if (window["WebSocket"] && !conn) {
      var protocol = window.location.protocol == "https:" ? "wss://" : "ws://";
      var port = window.location.protocol == "https:" ? ":8443" : "";
      var conn_url = protocol + location.host + port + "/api/v1/websocket";
      console.log("connecting to " + conn_url);
      conn = new WebSocket(conn_url);

      conn.onclose = function(evt) {
        console.log("websocket closed");
        console.log(evt);
        conn = null;
        setTimeout(function(){self.initialize(self)}, 3000);
      };

      conn.onerror = function(evt) {
        console.log("websocket error");
        console.log(evt);
      };

      conn.onmessage = function(evt) {
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
  sendMessage: function (msg) {
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

  switch(action.type) {
    case ActionTypes.RECIEVED_MSG:
      SocketStore.emitChange(action.msg);
      break;
    default:
  }
});

SocketStore.initialize();
module.exports = SocketStore;




