// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import {WebrtcActionTypes} from 'utils/constants.jsx';

class WebrtcStoreClass extends EventEmitter {
    constructor() {
        super();

        this.video_call_with = null;
    }

    setVideoCallWith(userId) {
        this.video_call_with = userId;
        this.emitBusy(userId !== null);
    }

    getVideoCallWith() {
        return this.video_call_with;
    }

    isBusy() {
        return this.video_call_with !== null;
    }

    emitInit(userId, isCaller) {
        this.emit(WebrtcActionTypes.INITIALIZE, userId, isCaller);
    }

    addInitListener(callback) {
        this.on(WebrtcActionTypes.INITIALIZE, callback);
    }

    removeInitListener(callback) {
        this.removeListener(WebrtcActionTypes.INITIALIZE, callback);
    }

    emitBusy(isBusy) {
        this.emit(WebrtcActionTypes.BUSY, isBusy);
    }

    addBusyListener(callback) {
        this.on(WebrtcActionTypes.BUSY, callback);
    }

    removeBusyListener(callback) {
        this.removeListener(WebrtcActionTypes.BUSY, callback);
    }

    emitNotify(message) {
        this.emit(WebrtcActionTypes.NOTIFY, message);
    }

    addNotifyListener(callback) {
        this.on(WebrtcActionTypes.NOTIFY, callback);
    }

    removeNotifyListener(callback) {
        this.removeListener(WebrtcActionTypes.NOTIFY, callback);
    }

    emitChanged(message) {
        this.emit(WebrtcActionTypes.CHANGED, message);
    }

    addChangedListener(callback) {
        this.on(WebrtcActionTypes.CHANGED, callback);
    }

    removeChangedListener(callback) {
        this.removeListener(WebrtcActionTypes.CHANGED, callback);
    }

    emitRhsChanged(isOpen) {
        this.emit(WebrtcActionTypes.RHS, isOpen);
    }

    addRhsChangedListener(callback) {
        this.on(WebrtcActionTypes.RHS, callback);
    }

    removeRhsChangedListener(callback) {
        this.removeListener(WebrtcActionTypes.RHS, callback);
    }
}

var WebrtcStore = new WebrtcStoreClass();
WebrtcStore.setMaxListeners(0);

WebrtcStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case WebrtcActionTypes.INITIALIZE:
        WebrtcStore.emitInit(action.user_id, action.is_calling);
        break;
    case WebrtcActionTypes.NOTIFY:
        WebrtcStore.emitNotify(action.message);
        break;
    default:
        if (action.message) {
            WebrtcStore.emitChanged(action.message);
        }
        break;
    }
});

export default WebrtcStore;
