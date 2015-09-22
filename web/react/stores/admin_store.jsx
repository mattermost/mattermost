// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var LOG_CHANGE_EVENT = 'log_change';
var CONFIG_CHANGE_EVENT = 'config_change';

class AdminStoreClass extends EventEmitter {
    constructor() {
        super();

        this.logs = null;
        this.config = null;

        this.emitLogChange = this.emitLogChange.bind(this);
        this.addLogChangeListener = this.addLogChangeListener.bind(this);
        this.removeLogChangeListener = this.removeLogChangeListener.bind(this);

        this.emitConfigChange = this.emitConfigChange.bind(this);
        this.addConfigChangeListener = this.addConfigChangeListener.bind(this);
        this.removeConfigChangeListener = this.removeConfigChangeListener.bind(this);
    }

    emitLogChange() {
        this.emit(LOG_CHANGE_EVENT);
    }

    addLogChangeListener(callback) {
        this.on(LOG_CHANGE_EVENT, callback);
    }

    removeLogChangeListener(callback) {
        this.removeListener(LOG_CHANGE_EVENT, callback);
    }

    emitConfigChange() {
        this.emit(CONFIG_CHANGE_EVENT);
    }

    addConfigChangeListener(callback) {
        this.on(CONFIG_CHANGE_EVENT, callback);
    }

    removeConfigChangeListener(callback) {
        this.removeListener(CONFIG_CHANGE_EVENT, callback);
    }

    getLogs() {
        return this.logs;
    }

    saveLogs(logs) {
        this.logs = logs;
    }

    getConfig() {
        return this.config;
    }

    saveConfig(config) {
        this.config = config;
    }
}

var AdminStore = new AdminStoreClass();

AdminStoreClass.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_LOGS:
        AdminStore.saveLogs(action.logs);
        AdminStore.emitLogChange();
        break;
    case ActionTypes.RECIEVED_CONFIG:
        AdminStore.saveConfig(action.config);
        AdminStore.emitConfigChange();
        break;
    default:
    }
});

export default AdminStore;
