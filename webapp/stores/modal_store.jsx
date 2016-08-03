// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
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
        // toggle event handlers should accept a boolean show/hide value and can accept a map of arguments
        const {type, value, ...args} = payload.action; //eslint-disable-line no-use-before-define

        switch (type) {
        case ActionTypes.TOGGLE_IMPORT_THEME_MODAL:
        case ActionTypes.TOGGLE_INVITE_MEMBER_MODAL:
        case ActionTypes.TOGGLE_LEAVE_TEAM_MODAL:
        case ActionTypes.TOGGLE_DELETE_POST_MODAL:
        case ActionTypes.TOGGLE_GET_POST_LINK_MODAL:
        case ActionTypes.TOGGLE_GET_TEAM_INVITE_LINK_MODAL:
        case ActionTypes.TOGGLE_GET_PUBLIC_LINK_MODAL:
            this.emit(type, value, args);
            break;
        }
    }
}

const ModalStore = new ModalStoreClass();
export default ModalStore;
