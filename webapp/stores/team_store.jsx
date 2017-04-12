// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import Constants from 'utils/constants.jsx';
const NotificationPrefs = Constants.NotificationPrefs;
const PostTypes = Constants.PostTypes;

import {getSiteURL} from 'utils/url.jsx';
const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';
const STATS_EVENT = 'stats';
const UNREAD_EVENT = 'unread';

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

    emitUnreadChange() {
        this.emit(UNREAD_EVENT);
    }

    addUnreadChangeListener(callback) {
        this.on(UNREAD_EVENT, callback);
    }

    removeUnreadChangeListener(callback) {
        this.removeListener(UNREAD_EVENT, callback);
    }

    get(id) {
        var c = this.getAll();
        return c[id];
    }

    getByName(name) {
        const t = this.getAll();

        for (const id in t) {
            if (t.hasOwnProperty(id)) {
                if (t[id].name === name) {
                    return t[id];
                }
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
            return getSiteURL() + '/signup_user_complete/?id=' + current.invite_id;
        }

        return '';
    }

    getTeamUrl(id) {
        const team = this.get(id);

        if (!team) {
            return '';
        }

        return getSiteURL() + '/' + team.name;
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

    updateTeam(team) {
        const t = JSON.parse(team);
        if (this.teams && this.teams[t.id]) {
            this.teams[t.id] = t;
        }

        if (this.teamListings && this.teamListings[t.id]) {
            if (t.allow_open_invite) {
                this.teamListings[t.id] = t;
            } else {
                Reflect.deleteProperty(this.teamListings, t.id);
            }
        } else if (t.allow_open_invite) {
            this.teamListings[t.id] = t;
        }

        this.emitChange();
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

    saveMyTeamMembersUnread(members) {
        for (let i = 0; i < this.my_team_members.length; i++) {
            const team = this.my_team_members[i];
            const member = members.filter((m) => m.team_id === team.team_id)[0];

            if (member) {
                this.my_team_members[i] = Object.assign({},
                    team,
                    {
                        msg_count: member.msg_count,
                        mention_count: member.mention_count
                    });
            }
        }
    }

    removeMyTeamMember(teamId) {
        for (let i = 0; i < this.my_team_members.length; i++) {
            if (this.my_team_members[i].team_id === teamId) {
                this.my_team_members.splice(i, 1);
            }
        }
        this.emitChange();
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

    removeMemberNotInTeam(teamId = this.getCurrentId(), userId) {
        if (this.members_not_in_team[teamId]) {
            Reflect.deleteProperty(this.members_not_in_team[teamId], userId);
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

    isTeamAdminForAnyTeam() {
        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        for (const teamMember of this.getMyTeamMembers()) {
            if (Utils.isAdmin(teamMember.roles)) {
                return true;
            }
        }

        return false;
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

    updateUnreadCount(teamId, totalMsgCount, channelMember) {
        const member = this.my_team_members.filter((m) => m.team_id === teamId)[0];
        if (member) {
            member.msg_count -= (totalMsgCount - channelMember.msg_count);
            member.mention_count -= channelMember.mention_count;
        }
    }

    subtractUnread(teamId, msgs, mentions) {
        const member = this.my_team_members.filter((m) => m.team_id === teamId)[0];
        if (member) {
            const msgCount = member.msg_count - msgs;
            const mentionCount = member.mention_count - mentions;

            member.msg_count = (msgCount > 0) ? msgCount : 0;
            member.mention_count = (mentionCount > 0) ? mentionCount : 0;
        }
    }

    incrementMessages(id, channelId) {
        const channelMember = ChannelStore.getMyMember(channelId);
        if (channelMember && channelMember.notify_props && channelMember.notify_props.mark_unread === NotificationPrefs.MENTION) {
            return;
        }

        const member = this.my_team_members.filter((m) => m.team_id === id)[0];
        member.msg_count++;
    }

    incrementMentionsIfNeeded(id, msgProps) {
        let mentions = [];
        if (msgProps && msgProps.mentions) {
            mentions = JSON.parse(msgProps.mentions);
        }

        if (mentions.indexOf(UserStore.getCurrentId()) !== -1) {
            const member = this.my_team_members.filter((m) => m.team_id === id)[0];
            member.mention_count++;
        }
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
    case ActionTypes.RECEIVED_TEAM:
        TeamStore.saveTeam(action.team);
        TeamStore.emitChange();
        break;
    case ActionTypes.CREATED_TEAM:
        TeamStore.saveTeam(action.team);
        TeamStore.appendMyTeamMember(action.member);
        TeamStore.emitChange();
        break;
    case ActionTypes.UPDATE_TEAM:
        TeamStore.saveTeam(action.team);
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
    case ActionTypes.RECEIVED_MY_TEAMS_UNREAD:
        TeamStore.saveMyTeamMembersUnread(action.team_members);
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
    case ActionTypes.CLICK_CHANNEL:
        if (action.channelMember) {
            TeamStore.updateUnreadCount(action.team_id, action.total_msg_count, action.channelMember);
            TeamStore.emitUnreadChange();
        }
        break;
    case ActionTypes.RECEIVED_POST:
        if (action.post.type === PostTypes.JOIN_LEAVE || action.post.type === PostTypes.JOIN_CHANNEL || action.post.type === PostTypes.LEAVE_CHANNEL) {
            return;
        }

        var id = action.websocketMessageProps ? action.websocketMessageProps.team_id : null;
        if (id && TeamStore.getCurrentId() !== id) {
            TeamStore.incrementMessages(id, action.post.channel_id);
            TeamStore.incrementMentionsIfNeeded(id, action.websocketMessageProps);
            TeamStore.emitChange();
        }
        break;
    default:
    }
});

TeamStore.setMaxListeners(15);

window.TeamStore = TeamStore;
export default TeamStore;
