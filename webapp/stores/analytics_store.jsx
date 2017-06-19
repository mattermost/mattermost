// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EventEmitter from 'events';

const CHANGE_EVENT = 'change';

import store from 'stores/redux_store.jsx';

class AnalyticsStoreClass extends EventEmitter {
    constructor() {
        super();

        this.entities = {};

        store.subscribe(() => {
            const newEntities = store.getState().entities.admin;

            if (newEntities.analytics !== this.entities.analytics) {
                this.emitChange();
            }

            if (newEntities.teamAnalytics !== this.entities.teamAnalytics) {
                this.emitChange();
            }

            this.entities = newEntities;
        });
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

    getAllSystem() {
        return JSON.parse(JSON.stringify(store.getState().entities.admin.analytics));
    }

    getAllTeam(id) {
        const teamStats = store.getState().entities.admin.teamAnalytics[id];
        if (teamStats) {
            return JSON.parse(JSON.stringify(teamStats));
        }

        return {};
    }
}

var AnalyticsStore = new AnalyticsStoreClass();
export default AnalyticsStore;
