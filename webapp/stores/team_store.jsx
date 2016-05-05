// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

var Utils;
function getWindowLocationOrigin() {
    if (!Utils) {
        Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
    }
    return Utils.getWindowLocationOrigin();
}

class TeamStoreClass extends EventEmitter {
    constructor() {
        super();
        this.clear();
    }

    clear() {
        this.teams = {};
        this.teamMembers = [];
        this.teammateMembers = {};
        this.teamListings = {};
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

    getCurrentTeamRelativeUrl() {
        if (this.getCurrent()) {
            return '/' + this.getCurrent().name;
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

    saveTeamMembers(members) {
        this.teamMembers = members;
    }

    appendTeamMember(member) {
        this.teamMembers.push(member);
    }

    getTeamMembers() {
        return this.teamMembers;
    }

    saveTeammateMembers(members, teamId) {
        if (teamId) {
            if (!(teamId in this.teammateMembers)) {
                this.teammateMembers[teamId] = {};
            }
            Object.assign(this.teammateMembers[teamId], members);
            return;
        }

        for (const key in members) {
            if (!members.hasOwnProperty(key)) {
                continue;
            }
            const tm = members[key];
            if (!(tm.team_id in this.teammateMembers)) {
                this.teammateMembers[tm.team_id] = {};
            }
            this.teammateMembers[tm.team_id][tm.user_id] = tm;
        }
    }

    getCurrentTeammateMembers() {
        return this.teammateMembers[this.getCurrentId()] || {};
    }

    saveTeamListings(teams) {
        this.teamListings = teams;
    }

    getTeamListings() {
        return this.teamListings;
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
    case ActionTypes.RECEIVED_TEAM_MEMBERS:
        TeamStore.saveTeamMembers(action.team_members);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_ALL_TEAM_LISTINGS:
        TeamStore.saveTeamListings(action.teams);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_TEAMMATE_MEMBERS:
        TeamStore.saveTeammateMembers(action.team_members, action.team_id);
        TeamStore.emitChange();
        break;
    default:
    }
});

export default TeamStore;
