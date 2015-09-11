// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var LOG_CHANGE_EVENT = 'log_change';

class AdminStoreClass extends EventEmitter {
    constructor() {
        super();

        this.logs = null;

        this.emitLogChange = this.emitLogChange.bind(this);
        this.addLogChangeListener = this.addLogChangeListener.bind(this);
        this.removeLogChangeListener = this.removeLogChangeListener.bind(this);
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

    getLogs() {
        //return BrowserStore.getItem('logs');
        return this.logs;
    }

    saveLogs(logs) {
        // if (logs === null) {
        //     BrowserStore.removeItem('logs');
        // } else {
        //     BrowserStore.setItem('logs', logs);
        // }

        this.logs = logs;
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
    default:
    }
});

export default AdminStore;
