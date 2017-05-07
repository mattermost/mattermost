// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import BrowserStore from 'stores/browser_store.jsx';

const CHANGE_EVENT = 'change';

class ErrorStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.getLastError = this.getLastError.bind(this);
        this.storeLastError = this.storeLastError.bind(this);
        this.getIgnoreNotification = this.getIgnoreNotification.bind(this);
        this.ignore_notification = false;
    }

    getIgnoreNotification() {
        return this.ignore_notification;
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

    getLastError() {
        return BrowserStore.getGlobalItem('last_error');
    }

    storeLastError(error) {
        BrowserStore.setGlobalItem('last_error', error);
    }

    getConnectionErrorCount() {
        var count = BrowserStore.getGlobalItem('last_error_conn');

        if (count == null) {
            return 0;
        }

        return count;
    }

    setConnectionErrorCount(count) {
        BrowserStore.setGlobalItem('last_error_conn', count);
    }

    clearError(message) {
        const lastError = this.getLastError();

        if (lastError && lastError.message === message) {
            this.clearLastError(true);
        }
    }

    clearLastError(force) {
        var lastError = this.getLastError();

        // preview message can only be cleared by clearNotificationError
        if (!force && lastError && lastError.notification) {
            return;
        }

        BrowserStore.removeGlobalItem('last_error');
        BrowserStore.removeGlobalItem('last_error_conn');
        if (lastError) {
            this.emitChange();
        }
    }

    clearNotificationError() {
        this.ignore_notification = true;
        this.storeLastError('');
        this.clearLastError();
    }
}

var ErrorStore = new ErrorStoreClass();

ErrorStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;
    switch (action.type) {
    case ActionTypes.RECEIVED_ERROR:
        ErrorStore.storeLastError(action.err);
        ErrorStore.emitChange();
        break;

    default:
    }
});

export default ErrorStore;
window.ErrorStore = ErrorStore;
