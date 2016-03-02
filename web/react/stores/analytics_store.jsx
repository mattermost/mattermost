// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

class AnalyticsStoreClass extends EventEmitter {
    constructor() {
        super();
        this.systemStats = {};
        this.teamStats = {};
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
        return JSON.parse(JSON.stringify(this.systemStats));
    }

    getAllTeam(id) {
        if (id in this.teamStats) {
            return JSON.parse(JSON.stringify(this.teamStats[id]));
        }

        return {};
    }

    storeSystemStats(newStats) {
        for (const stat in newStats) {
            if (!newStats.hasOwnProperty(stat)) {
                continue;
            }
            this.systemStats[stat] = newStats[stat];
        }
    }

    storeTeamStats(id, newStats) {
        if (!(id in this.teamStats)) {
            this.teamStats[id] = {};
        }

        for (const stat in newStats) {
            if (!newStats.hasOwnProperty(stat)) {
                continue;
            }
            this.teamStats[id][stat] = newStats[stat];
        }
    }

}

var AnalyticsStore = new AnalyticsStoreClass();

AnalyticsStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_ANALYTICS:
        if (action.teamId == null) {
            AnalyticsStore.storeSystemStats(action.stats);
        } else {
            AnalyticsStore.storeTeamStats(action.teamId, action.stats);
        }
        AnalyticsStore.emitChange();
        break;
    default:
    }
});

export default AnalyticsStore;
