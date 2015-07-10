// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var BrowserStore = require('../stores/browser_store.jsx');

var CHANGE_EVENT = 'change';

var ErrorStore = assign({}, EventEmitter.prototype, {

  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },
  handledError: function() {
    BrowserStore.removeItem("last_error");
  },
  getLastError: function() {
    var error = null;
    try {
        error = JSON.parse(BrowserStore.getItem("last_error"));
    }
    catch (err) {
    }

    return error;
  },

  _storeLastError: function(error) {
    BrowserStore.setItem("last_error", JSON.stringify(error));
  },
});

ErrorStore.dispatchToken = AppDispatcher.register(function(payload) {
  var action = payload.action;
  switch(action.type) {
    case ActionTypes.RECIEVED_ERROR:
      ErrorStore._storeLastError(action.err);
      ErrorStore.emitChange();
      break;

    default:
  }
});

module.exports = ErrorStore;


