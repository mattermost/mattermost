// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

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
        this.getCurrentInviteLink = this.getCurrentInviteLink.bind(this);
        this.saveTeam = this.saveTeam.bind(this);

        this.teams = {};
        this.currentTeamId = '';
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
        return this.teams;
    }

    getCurrentId() {
        var team = this.get(this.currentTeamId);

        if (team) {
            return team.id;
        }

        return null;
    }

    getCurrent() {
        const team = this.teams[this.currentTeamId];

        if (team) {
            return team;
        }

        return null;
    }

    getCurrentTeamUrl() {
        if (this.getCurrent()) {
            return getWindowLocationOrigin() + '/' + this.getCurrent().name;
        }
        return null;
    }

    getCurrentInviteLink() {
        const current = this.getCurrent();

        if (current) {
            return getWindowLocationOrigin() + '/signup_user_complete/?id=' + current.invite_id;
        }

        return '';
    }

    saveTeam(team) {
        this.teams[team.id] = team;
    }

    saveTeams(teams) {
        this.teams = teams;
    }

    saveMyTeam(team) {
        this.saveTeam(team);
        this.currentTeamId = team.id;
    }
}

var TeamStore = new TeamStoreClass();

TeamStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_MY_TEAM:
        TeamStore.saveMyTeam(action.team);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_ALL_TEAMS:
        TeamStore.saveTeams(action.teams);
        TeamStore.emitChange();
        break;
    default:
    }
});

export default TeamStore;
