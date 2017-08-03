// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EventEmitter from 'events';

const CHANGE_EVENT = 'changed';

import store from 'stores/redux_store.jsx';

class IntegrationStore extends EventEmitter {
    constructor() {
        super();

        this.entities = {};

        store.subscribe(() => {
            const newEntities = store.getState().entities.integrations;
            if (newEntities !== this.entities) {
                this.emitChange();
            }

            this.entities = newEntities;
        });
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
        const hooks = store.getState().entities.integrations.incomingHooks || {};

        let hasTeam = false;
        Object.values(hooks).forEach((hook) => {
            if (hook.team_id === teamId) {
                hasTeam = true;
            }
        });

        return hasTeam;
    }

    getIncomingWebhooks(teamId) {
        const hooks = store.getState().entities.integrations.incomingHooks;

        const teamHooks = [];
        Object.values(hooks).forEach((hook) => {
            if (hook.team_id === teamId) {
                teamHooks.push(hook);
            }
        });

        return teamHooks;
    }

    hasReceivedOutgoingWebhooks(teamId) {
        const hooks = store.getState().entities.integrations.outgoingHooks;

        let hasTeam = false;
        Object.values(hooks).forEach((hook) => {
            if (hook.team_id === teamId) {
                hasTeam = true;
            }
        });

        return hasTeam;
    }

    getOutgoingWebhooks(teamId) {
        const hooks = store.getState().entities.integrations.outgoingHooks;

        const teamHooks = [];
        Object.values(hooks).forEach((hook) => {
            if (hook.team_id === teamId) {
                teamHooks.push(hook);
            }
        });

        return teamHooks;
    }

    getOutgoingWebhook(teamId, id) {
        return store.getState().entities.integrations.outgoingHooks[id];
    }

    hasReceivedOAuthApps() {
        return Object.keys(store.getState().entities.integrations.oauthApps).length > 0;
    }

    getOAuthApps() {
        return Object.values(store.getState().entities.integrations.oauthApps);
    }
}

export default new IntegrationStore();
