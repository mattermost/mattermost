// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import EventEmitter from 'events';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class FileStore extends EventEmitter {
    constructor() {
        super();

        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.emitChange = this.emitChange.bind(this);

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);

        this.fileInfo = new Map();
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }
    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }
    emitChange(filename) {
        this.emit(CHANGE_EVENT, filename);
    }

    hasInfo(filename) {
        return this.fileInfo.has(filename);
    }

    getInfo(filename) {
        return this.fileInfo.get(filename);
    }

    setInfo(filename, info) {
        this.fileInfo.set(filename, info);
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECIEVED_FILE_INFO:
            this.setInfo(action.filename, action.info);
            this.emitChange(action.filename);
            break;
        }
    }
}

export default new FileStore();
