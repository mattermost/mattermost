// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const EventEmitter = require('events').EventEmitter;

const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;

class ModalStoreClass extends EventEmitter {
    constructor() {
        super();

        this.addModalListener = this.addModalListener.bind(this);
        this.removeModalListener = this.removeModalListener.bind(this);

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);
    }

    addModalListener(action, callback) {
        this.on(action, callback);
    }

    removeModalListener(action, callback) {
        this.removeListener(action, callback);
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.TOGGLE_IMPORT_THEME_MODAL:
        case ActionTypes.TOGGLE_INVITE_MEMBER_MODAL:
            this.emit(action.type, action.value);
            break;
        }
    }
}

const ModalStore = new ModalStoreClass();
export default ModalStore;
