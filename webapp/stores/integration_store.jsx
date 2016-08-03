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

        this.incomingWebhooks = new Map();

        this.outgoingWebhooks = new Map();

        this.commands = new Map();

        this.oauthApps = new Map();
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

    hasReceivedIncomingWebhooks(teamId) {
        return this.incomingWebhooks.has(teamId);
    }

    getIncomingWebhooks(teamId) {
        return this.incomingWebhooks.get(teamId) || [];
    }

    setIncomingWebhooks(teamId, incomingWebhooks) {
        this.incomingWebhooks.set(teamId, incomingWebhooks);
    }

    addIncomingWebhook(incomingWebhook) {
        const teamId = incomingWebhook.team_id;
        const incomingWebhooks = this.getIncomingWebhooks(teamId);

        incomingWebhooks.push(incomingWebhook);

        this.setIncomingWebhooks(teamId, incomingWebhooks);
    }

    removeIncomingWebhook(teamId, id) {
        let incomingWebhooks = this.getIncomingWebhooks(teamId);

        incomingWebhooks = incomingWebhooks.filter((incomingWebhook) => incomingWebhook.id !== id);

        this.setIncomingWebhooks(teamId, incomingWebhooks);
    }

    hasReceivedOutgoingWebhooks(teamId) {
        return this.outgoingWebhooks.has(teamId);
    }

    getOutgoingWebhooks(teamId) {
        return this.outgoingWebhooks.get(teamId) || [];
    }

    setOutgoingWebhooks(teamId, outgoingWebhooks) {
        this.outgoingWebhooks.set(teamId, outgoingWebhooks);
    }

    addOutgoingWebhook(outgoingWebhook) {
        const teamId = outgoingWebhook.team_id;
        const outgoingWebhooks = this.getOutgoingWebhooks(teamId);

        outgoingWebhooks.push(outgoingWebhook);

        this.setOutgoingWebhooks(teamId, outgoingWebhooks);
    }

    updateOutgoingWebhook(outgoingWebhook) {
        const teamId = outgoingWebhook.team_id;
        const outgoingWebhooks = this.getOutgoingWebhooks(teamId);

        for (let i = 0; i < outgoingWebhooks.length; i++) {
            if (outgoingWebhooks[i].id === outgoingWebhook.id) {
                outgoingWebhooks[i] = outgoingWebhook;
                break;
            }
        }

        this.setOutgoingWebhooks(teamId, outgoingWebhooks);
    }

    removeOutgoingWebhook(teamId, id) {
        let outgoingWebhooks = this.getOutgoingWebhooks(teamId);

        outgoingWebhooks = outgoingWebhooks.filter((outgoingWebhook) => outgoingWebhook.id !== id);

        this.setOutgoingWebhooks(teamId, outgoingWebhooks);
    }

    hasReceivedCommands(teamId) {
        return this.commands.has(teamId);
    }

    getCommands(teamId) {
        return this.commands.get(teamId) || [];
    }

    setCommands(teamId, commands) {
        this.commands.set(teamId, commands);
    }

    addCommand(command) {
        const teamId = command.team_id;
        const commands = this.getCommands(teamId);

        commands.push(command);

        this.setCommands(teamId, commands);
    }

    updateCommand(command) {
        const teamId = command.team_id;
        const commands = this.getCommands(teamId);

        for (let i = 0; i < commands.length; i++) {
            if (commands[i].id === command.id) {
                commands[i] = command;
                break;
            }
        }

        this.setCommands(teamId, commands);
    }

    removeCommand(teamId, id) {
        let commands = this.getCommands(teamId);

        commands = commands.filter((command) => command.id !== id);

        this.setCommands(teamId, commands);
    }

    hasReceivedOAuthApps(userId) {
        return this.oauthApps.has(userId);
    }

    getOAuthApps(userId) {
        return this.oauthApps.get(userId) || [];
    }

    setOAuthApps(userId, oauthApps) {
        this.oauthApps.set(userId, oauthApps);
    }

    addOAuthApp(oauthApp) {
        const userId = oauthApp.creator_id;
        const oauthApps = this.getOAuthApps(userId);

        oauthApps.push(oauthApp);

        this.setOAuthApps(userId, oauthApps);
    }

    removeOAuthApp(userId, id) {
        let apps = this.getOAuthApps(userId);

        apps = apps.filter((app) => app.id !== id);

        this.setOAuthApps(userId, apps);
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_INCOMING_WEBHOOKS:
            this.setIncomingWebhooks(action.teamId, action.incomingWebhooks);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_INCOMING_WEBHOOK:
            this.addIncomingWebhook(action.incomingWebhook);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_INCOMING_WEBHOOK:
            this.removeIncomingWebhook(action.teamId, action.id);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OUTGOING_WEBHOOKS:
            this.setOutgoingWebhooks(action.teamId, action.outgoingWebhooks);
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
            this.removeOutgoingWebhook(action.teamId, action.id);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_COMMANDS:
            this.setCommands(action.teamId, action.commands);
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
            this.removeCommand(action.teamId, action.id);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OAUTHAPPS:
            this.setOAuthApps(action.userId, action.oauthApps);
            this.emitChange();
            break;
        case ActionTypes.RECEIVED_OAUTHAPP:
            this.addOAuthApp(action.oauthApp);
            this.emitChange();
            break;
        case ActionTypes.REMOVED_OAUTHAPP:
            this.removeOAuthApp(action.userId, action.id);
            this.emitChange();
            break;
        }
    }
}

export default new IntegrationStore();
