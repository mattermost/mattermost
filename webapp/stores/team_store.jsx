// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';

var Utils;

class TeamStoreClass extends EventEmitter {
    constructor() {
        super();
        this.clear();
    }

    clear() {
        this.teams = {};
        this.team_members = [];
        this.members_for_team = [];
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
            return window.mm_config.SiteURL + '/' + this.getCurrent().name;
        }
        return '';
    }

    getCurrentTeamRelativeUrl() {
        if (this.getCurrent()) {
            return '/' + this.getCurrent().name;
        }
        return '';
    }

    getCurrentInviteLink() {
        const current = this.getCurrent();

        if (current) {
            return window.mm_config.SiteURL + '/signup_user_complete/?id=' + current.invite_id;
        }

        return '';
    }

    getTeamUrl(id) {
        const team = this.get(id);
        if (team) {
            return window.mm_config.SiteURL + '/' + team.name;
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
        this.team_members = members;
    }

    appendTeamMember(member) {
        this.team_members.push(member);
    }

    removeTeamMember(teamId) {
        for (var index in this.team_members) {
            if (this.team_members.hasOwnProperty(index)) {
                if (this.team_members[index].team_id === teamId) {
                    Reflect.deleteProperty(this.team_members, index);
                }
            }
        }
    }

    getTeamMembers() {
        return this.team_members;
    }

    saveMembersForTeam(members) {
        this.members_for_team = members;
    }

    getMembersForTeam() {
        return this.members_for_team;
    }

    saveTeamListings(teams) {
        this.teamListings = teams;
    }

    getTeamListings() {
        return this.teamListings;
    }

    isTeamAdminForCurrentTeam() {
        return this.isTeamAdmin(UserStore.getCurrentId(), this.getCurrentId());
    }

    isTeamAdmin(userId, teamId) {
        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        var teamMembers = this.getTeamMembers();
        const teamMember = teamMembers.find((m) => m.user_id === userId && m.team_id === teamId);

        if (teamMember) {
            return Utils.isAdmin(teamMember.roles);
        }

        return false;
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
    case ActionTypes.CREATED_TEAM:
        TeamStore.saveTeam(action.team);
        TeamStore.appendTeamMember(action.member);
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
    case ActionTypes.RECEIVED_MEMBERS_FOR_TEAM:
        TeamStore.saveMembersForTeam(action.team_members);
        TeamStore.emitChange();
        break;
    default:
    }
});

window.TeamStore = TeamStore;
export default TeamStore;
