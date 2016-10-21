// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';
const STATS_EVENT = 'stats';

var Utils;

class TeamStoreClass extends EventEmitter {
    constructor() {
        super();
        this.clear();
    }

    clear() {
        this.teams = {};
        this.my_team_members = [];
        this.members_in_team = {};
        this.members_not_in_team = {};
        this.stats = {};
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

    emitStatsChange() {
        this.emit(STATS_EVENT);
    }

    addStatsChangeListener(callback) {
        this.on(STATS_EVENT, callback);
    }

    removeStatsChangeListener(callback) {
        this.removeListener(STATS_EVENT, callback);
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
        return this.currentTeamId;
    }

    setCurrentId(id) {
        this.currentTeamId = id;
    }

    getCurrent() {
        const team = this.teams[this.currentTeamId];

        if (team) {
            return team;
        }

        return null;
    }

    getCurrentTeamUrl() {
        return this.getTeamUrl(this.currentTeamId);
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
            // can't call Utils.getSiteURL here because that introduces a circular dependency
            const origin = window.mm_config.SiteURL || window.location.origin;

            return origin + '/signup_user_complete/?id=' + current.invite_id;
        }

        return '';
    }

    getTeamUrl(id) {
        const team = this.get(id);

        if (!team) {
            return '';
        }

        // can't call Utils.getSiteURL here because that introduces a circular dependency
        const origin = window.mm_config.SiteURL || window.location.origin;

        return origin + '/' + team.name;
    }

    getCurrentStats() {
        return this.getStats(this.getCurrentId());
    }

    getStats(teamId) {
        let stats;

        if (teamId) {
            stats = this.stats[teamId];
        }

        if (stats) {
            // create a defensive copy
            stats = Object.assign({}, stats);
        } else {
            stats = {member_count: 0};
        }

        return stats;
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

    saveStats(teamId, stats) {
        this.stats[teamId] = stats;
    }

    saveMyTeamMembers(members) {
        this.my_team_members = members;
    }

    appendMyTeamMember(member) {
        this.my_team_members.push(member);
    }

    removeMyTeamMember(teamId) {
        for (var index in this.my_team_members) {
            if (this.my_team_members.hasOwnProperty(index)) {
                if (this.my_team_members[index].team_id === teamId) {
                    Reflect.deleteProperty(this.my_team_members, index);
                }
            }
        }
    }

    getMyTeamMembers() {
        return this.my_team_members;
    }

    saveMembersInTeam(teamId = this.getCurrentId(), members) {
        const oldMembers = this.members_in_team[teamId] || {};
        this.members_in_team[teamId] = Object.assign({}, oldMembers, members);
    }

    saveMembersNotInTeam(teamId = this.getCurrentId(), nonmembers) {
        this.members_not_in_team[teamId] = nonmembers;
    }

    removeMemberInTeam(teamId = this.getCurrentId(), userId) {
        if (this.members_in_team[teamId]) {
            Reflect.deleteProperty(this.members_in_team[teamId], userId);
        }
    }

    getMembersInTeam(teamId = this.getCurrentId()) {
        return Object.assign({}, this.members_in_team[teamId]) || {};
    }

    hasActiveMemberInTeam(teamId = this.getCurrentId(), userId) {
        if (this.members_in_team[teamId] && this.members_in_team[teamId][userId]) {
            return true;
        }

        return false;
    }

    hasMemberNotInTeam(teamId = this.getCurrentId(), userId) {
        if (this.members_not_in_team[teamId] && this.members_not_in_team[teamId][userId]) {
            return true;
        }

        return false;
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

        var teamMembers = this.getMyTeamMembers();
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
        TeamStore.appendMyTeamMember(action.member);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_ALL_TEAMS:
        TeamStore.saveTeams(action.teams);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_MY_TEAM_MEMBERS:
        TeamStore.saveMyTeamMembers(action.team_members);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_ALL_TEAM_LISTINGS:
        TeamStore.saveTeamListings(action.teams);
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_MEMBERS_IN_TEAM:
        TeamStore.saveMembersInTeam(action.team_id, action.team_members);
        if (action.non_team_members) {
            TeamStore.saveMembersNotInTeam(action.team_id, action.non_team_members);
        }
        TeamStore.emitChange();
        break;
    case ActionTypes.RECEIVED_TEAM_STATS:
        TeamStore.saveStats(action.team_id, action.stats);
        TeamStore.emitStatsChange();
        break;
    default:
    }
});

window.TeamStore = TeamStore;
export default TeamStore;
