// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var CHANGE_EVENT = 'change';

class ConfigStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.getSetting = this.getSetting.bind(this);
        this.getSettingAsBoolean = this.getSettingAsBoolean.bind(this);
        this.updateStoredSettings = this.updateStoredSettings.bind(this);
    }
    emitChange() {
        this.emit(CHANGE_EVENT);
    }
    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }
    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }
    getSetting(key, defaultValue) {
        return BrowserStore.getItem('config_' + key, defaultValue);
    }
    getSettingAsBoolean(key, defaultValue) {
        var value = this.getSetting(key, defaultValue);

        if (typeof value !== 'string') {
            return Boolean(value);
        }

        return value === 'true';
    }
    updateStoredSettings(settings) {
        for (let key in settings) {
            if (settings.hasOwnProperty(key)) {
                BrowserStore.setItem('config_' + key, settings[key]);
            }
        }
    }
}

var ConfigStore = new ConfigStoreClass();

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

export default ConfigStore;
