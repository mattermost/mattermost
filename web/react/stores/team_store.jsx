// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var BrowserStore = require('../stores/browser_store.jsx');

var CHANGE_EVENT = 'change';

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
        this.setCurrentId = this.setCurrentId.bind(this);
        this.getCurrentId = this.getCurrentId.bind(this);
        this.getCurrent = this.getCurrent.bind(this);
        this.getCurrentTeamUrl = this.getCurrentTeamUrl.bind(this);
        this.storeTeam = this.storeTeam.bind(this);
        this.pStoreTeams = this.pStoreTeams.bind(this);
        this.pGetTeams = this.pGetTeams.bind(this);
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
        var c = this.pGetTeams();
        return c[id];
    }
    getByName(name) {
        var t = this.pGetTeams();

        for (var id in t) {
            if (t[id].name === name) {
                return t[id];
            }
        }

        return null;
    }
    getAll() {
        return this.pGetTeams();
    }
    setCurrentId(id) {
        if (id === null) {
            BrowserStore.removeItem('current_team_id');
        } else {
            BrowserStore.setItem('current_team_id', id);
        }
    }
    getCurrentId() {
        return BrowserStore.getItem('current_team_id');
    }
    getCurrent() {
        var currentId = this.getCurrentId();

        if (currentId !== null) {
            return this.get(currentId);
        }
        return null;
    }
    getCurrentTeamUrl() {
        if (this.getCurrent()) {
            return getWindowLocationOrigin() + '/' + this.getCurrent().name;
        }
        return null;
    }
    storeTeam(team) {
        var teams = this.pGetTeams();
        teams[team.id] = team;
        this.pStoreTeams(teams);
    }
    pStoreTeams(teams) {
        BrowserStore.setItem('user_teams', teams);
    }
    pGetTeams() {
        return BrowserStore.getItem('user_teams', {});
    }
}

var TeamStore = new TeamStoreClass();

TeamStore.dispatchToken = AppDispatcher.register(function registry(payload) {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.CLICK_TEAM:
        TeamStore.setCurrentId(action.id);
        TeamStore.emitChange();
        break;

    case ActionTypes.RECIEVED_TEAM:
        TeamStore.storeTeam(action.team);
        TeamStore.emitChange();
        break;

    default:
    }
});

export default TeamStore;
