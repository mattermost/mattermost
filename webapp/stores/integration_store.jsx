// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';
import * as Utils from 'utils/utils.jsx';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class IntegrationStore extends EventEmitter {
    constructor() {
        super();

        this.dispatchToken = AppDispatcher.register(this.handleEventPayload.bind(this));

        this.incomingWebhooks = [];
        this.receivedIncomingWebhooks = false;

        this.outgoingWebhooks = [];
        this.receivedOutgoingWebhooks = false;
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    hasReceivedIncomingWebhooks() {
        return this.receivedIncomingWebhooks;
    }

    getIncomingWebhooks() {
        return this.incomingWebhooks;
    }

    setIncomingWebhooks(incomingWebhooks) {
        this.incomingWebhooks = Utils.freezeArray(incomingWebhooks);
        this.receivedIncomingWebhooks = true;
    }

    hasReceivedOutgoingWebhooks() {
        return this.receivedIncomingWebhooks;
    }

    getOutgoingWebhooks() {
        return this.outgoingWebhooks;
    }

    setOutgoingWebhooks(outgoingWebhooks) {
        this.outgoingWebhooks = Utils.freezeArray(outgoingWebhooks);
        this.receivedOutgoingWebhooks = true;
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_INCOMING_WEBHOOKS:
            this.setIncomingWebhooks(action.incomingWebhooks);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OUTGOING_WEBHOOKS:
            this.setOutgoingWebhooks(action.outgoingWebhooks);
            this.emitChange();
            break;
        }
    }
}

export default new IntegrationStore();
