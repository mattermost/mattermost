// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';

var ConfigStore = assign({}, EventEmitter.prototype, {
    emitChange: function emitChange() {
        this.emit(CHANGE_EVENT);
    },
    addChangeListener: function addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    },
    removeChangeListener: function removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    },
    getSetting: function getSetting(key, defaultValue) {
        return BrowserStore.getItem('config_' + key, defaultValue);
    },
    getSettingAsBoolean: function getSettingAsNumber(key, defaultValue) {
        var value = ConfigStore.getSetting(key, defaultValue);

        if (typeof value !== 'string') {
            return !!value;
        } else {
            return value === 'true';
        }
    },
    updateStoredSettings: function updateStoredSettings(settings) {
        for (var key in settings) {
            BrowserStore.setItem('config_' + key, settings[key]);
        }
    }
});

ConfigStore.dispatchToken = AppDispatcher.register(function registry(payload) {
    var action = payload.action;

    switch (action.type) {
        case ActionTypes.RECIEVED_CONFIG:
            ConfigStore.updateStoredSettings(action.settings);
            ConfigStore.emitChange();
            break;
        default:
    }
});

module.exports = ConfigStore;
