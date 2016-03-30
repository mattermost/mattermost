// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

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

        this.slashCommands = [];
        this.receivedSlashCommands = false;
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
        this.incomingWebhooks = incomingWebhooks;
        this.receivedIncomingWebhooks = true;
    }

    addIncomingWebhook(incomingWebhook) {
        this.incomingWebhooks.push(incomingWebhook);
    }

    removeIncomingWebhook(id) {
        for (let i = 0; i < this.incomingWebhooks.length; i++) {
            if (this.incomingWebhooks[i].id === id) {
                this.incomingWebhooks.splice(i, 1);
                break;
            }
        }
    }

    hasReceivedOutgoingWebhooks() {
        return this.receivedOutgoingWebhooks;
    }

    getOutgoingWebhooks() {
        return this.outgoingWebhooks;
    }

    setOutgoingWebhooks(outgoingWebhooks) {
        this.outgoingWebhooks = outgoingWebhooks;
        this.receivedOutgoingWebhooks = true;
    }

    addOutgoingWebhook(outgoingWebhook) {
        this.outgoingWebhooks.push(outgoingWebhook);
    }

    updateOutgoingWebhook(outgoingWebhook) {
        for (let i = 0; i < this.outgoingWebhooks.length; i++) {
            if (this.outgoingWebhooks[i].id === outgoingWebhook.id) {
                this.outgoingWebhooks[i] = outgoingWebhook;
                break;
            }
        }
    }

    removeOutgoingWebhook(id) {
        for (let i = 0; i < this.outgoingWebhooks.length; i++) {
            if (this.outgoingWebhooks[i].id === id) {
                this.outgoingWebhooks.splice(i, 1);
                break;
            }
        }
    }

    hasReceivedSlashCommands() {
        return this.receivedSlashCommands;
    }

    getSlashCommands() {
        return this.slashCommands;
    }

    setSlashCommands(slashCommands) {
        this.slashCommands = slashCommands;
        this.receivedSlashCommands = true;
    }

    addSlashCommand(slashCommand) {
        this.slashCommands.push(slashCommand);
    }

    updateSlashCommand(slashCommand) {
        for (let i = 0; i < this.slashCommands.length; i++) {
            if (this.slashCommands[i].id === slashCommand.id) {
                this.slashCommands[i] = slashCommand;
                break;
            }
        }
    }

    removeSlashCommand(id) {
        for (let i = 0; i < this.slashCommands.length; i++) {
            if (this.slashCommands[i].id === id) {
                this.slashCommands.splice(i, 1);
                break;
            }
        }
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_INCOMING_WEBHOOKS:
            this.setIncomingWebhooks(action.incomingWebhooks);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_INCOMING_WEBHOOK:
            this.addIncomingWebhook(action.incomingWebhook);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_INCOMING_WEBHOOK:
            this.removeIncomingWebhook(action.id);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OUTGOING_WEBHOOKS:
            this.setOutgoingWebhooks(action.outgoingWebhooks);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OUTGOING_WEBHOOK:
            this.addOutgoingWebhook(action.outgoingWebhook);
            this.emitChange();
            break;
        case ActionTypes.UPDATED_OUTGOING_WEBHOOK:
            this.updateOutgoingWebhook(action.outgoingWebhook);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_OUTGOING_WEBHOOK:
            this.removeOutgoingWebhook(action.id);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_SLASH_COMMANDS:
            this.setSlashCommands(action.slashCommands);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_SLASH_COMMAND:
            this.addSlashCommand(action.slashCommand);
            this.emitChange();
            break;
        case ActionTypes.UPDATED_SLASH_COMMAND:
            this.updateSlashCommand(action.slashCommand);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_SLASH_COMMAND:
            this.removeSlashCommand(action.id);
            this.emitChange();
            break;
        }
    }
}

const instance = new IntegrationStore();
export default instance;
window.IntegrationStore = instance;

