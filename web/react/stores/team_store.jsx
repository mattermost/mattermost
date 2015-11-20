// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import BrowserStore from '../stores/browser_store.jsx';

const CHANGE_EVENT = 'change';

var Utils;
function getWindowLocationOrigin() {
    if (!Utils) {
        Utils = require('../utils/utils.jsx'); //eslint-disable-line global-require
    }
    return Utils.getWindowLocationOrigin();
}

class TeamStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.get = this.get.bind(this);
        this.getByName = this.getByName.bind(this);
        this.getAll = this.getAll.bind(this);
        this.getCurrentId = this.getCurrentId.bind(this);
        this.getCurrent = this.getCurrent.bind(this);
        this.getCurrentTeamUrl = this.getCurrentTeamUrl.bind(this);
        this.saveTeam = this.saveTeam.bind(this);
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

    get(id) {
        var c = this.getAll();
        return c[id];
    }

    getByName(name) {
        var t = this.getAll();

        for (var id in t) {
            if (t[id].name === name) {
                return t[id];
            }
        }

        return null;
    }

    getAll() {
        return BrowserStore.getItem('user_teams', {});
    }

    getCurrentId() {
        var team = global.window.mm_team;

        if (team) {
            return team.id;
        }

        return null;
    }

    getCurrent() {
        if (global.window.mm_team != null && this.get(global.window.mm_team.id) == null) {
            this.saveTeam(global.window.mm_team);
        }

        return global.window.mm_team;
    }

    getCurrentTeamUrl() {
        if (this.getCurrent()) {
            return getWindowLocationOrigin() + '/' + this.getCurrent().name;
        }
        return null;
    }

    saveTeam(team) {
        var teams = this.getAll();
        teams[team.id] = team;
        BrowserStore.setItem('user_teams', teams);
    }
}

var TeamStore = new TeamStoreClass();

TeamStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_TEAM:
        TeamStore.saveTeam(action.team);
        TeamStore.emitChange();
        break;

    default:
    }
});

export default TeamStore;
