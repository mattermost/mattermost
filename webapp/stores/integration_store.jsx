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

        this.commands = [];
        this.receivedCommands = false;
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

    hasReceivedCommands() {
        return this.receivedCommands;
    }

    getCommands() {
        return this.commands;
    }

    setCommands(commands) {
        this.commands = commands;
        this.receivedCommands = true;
    }

    addCommand(command) {
        this.commands.push(command);
    }

    updateCommand(command) {
        for (let i = 0; i < this.commands.length; i++) {
            if (this.commands[i].id === command.id) {
                this.commands[i] = command;
                break;
            }
        }
    }

    removeCommand(id) {
        for (let i = 0; i < this.commands.length; i++) {
            if (this.commands[i].id === id) {
                this.commands.splice(i, 1);
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
        case ActionTypes.RECEIVED_COMMANDS:
            this.setCommands(action.commands);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_COMMAND:
            this.addCommand(action.command);
            this.emitChange();
            break;
        case ActionTypes.UPDATED_COMMAND:
            this.updateCommand(action.command);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_COMMAND:
            this.removeCommand(action.id);
            this.emitChange();
            break;
        }
    }
}

export default new IntegrationStore();
