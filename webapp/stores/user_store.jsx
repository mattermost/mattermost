// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import * as GlobalActions from 'actions/global_actions.jsx';
import LocalizationStore from './localization_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const UserStatuses = Constants.UserStatuses;

const CHANGE_EVENT_NOT_IN_CHANNEL = 'change_not_in_channel';
const CHANGE_EVENT_IN_CHANNEL = 'change_in_channel';
const CHANGE_EVENT_IN_TEAM = 'change_in_team';
const CHANGE_EVENT_WITHOUT_TEAM = 'change_without_team';
const CHANGE_EVENT = 'change';
const CHANGE_EVENT_SESSIONS = 'change_sessions';
const CHANGE_EVENT_AUDITS = 'change_audits';
const CHANGE_EVENT_STATUSES = 'change_statuses';

var Utils;

class UserStoreClass extends EventEmitter {
    constructor() {
        super();
        this.clear();
    }

    clear() {
        // All the profiles, regardless of where they came from
        this.profiles = {};
        this.paging_offset = 0;
        this.paging_count = 0;

        // Lists of sorted IDs for users in a team
        this.profiles_in_team = {};
        this.in_team_offset = 0;
        this.in_team_count = 0;

        // Lists of sorted IDs for users in a channel
        this.profiles_in_channel = {};
        this.in_channel_offset = {};
        this.in_channel_count = {};

        // Lists of sorted IDs for users not in a channel
        this.profiles_not_in_channel = {};
        this.not_in_channel_offset = {};
        this.not_in_channel_count = {};

        // Lists of sorted IDs for users without a team
        this.profiles_without_team = {};

        this.statuses = {};
        this.sessions = {};
        this.audits = [];
        this.currentUserId = '';
        this.noAccounts = false;
    }

    emitChange(userId) {
        this.emit(CHANGE_EVENT, userId);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitInTeamChange() {
        this.emit(CHANGE_EVENT_IN_TEAM);
    }

    addInTeamChangeListener(callback) {
        this.on(CHANGE_EVENT_IN_TEAM, callback);
    }

    removeInTeamChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_IN_TEAM, callback);
    }

    emitInChannelChange() {
        this.emit(CHANGE_EVENT_IN_CHANNEL);
    }

    addInChannelChangeListener(callback) {
        this.on(CHANGE_EVENT_IN_CHANNEL, callback);
    }

    removeInChannelChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_IN_CHANNEL, callback);
    }

    emitNotInChannelChange() {
        this.emit(CHANGE_EVENT_NOT_IN_CHANNEL);
    }

    addNotInChannelChangeListener(callback) {
        this.on(CHANGE_EVENT_NOT_IN_CHANNEL, callback);
    }

    removeNotInChannelChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_NOT_IN_CHANNEL, callback);
    }

    emitWithoutTeamChange() {
        this.emit(CHANGE_EVENT_WITHOUT_TEAM);
    }

    addWithoutTeamChangeListener(callback) {
        this.on(CHANGE_EVENT_WITHOUT_TEAM, callback);
    }

    removeWithoutTeamChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_WITHOUT_TEAM, callback);
    }

    emitSessionsChange() {
        this.emit(CHANGE_EVENT_SESSIONS);
    }

    addSessionsChangeListener(callback) {
        this.on(CHANGE_EVENT_SESSIONS, callback);
    }

    removeSessionsChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_SESSIONS, callback);
    }

    emitAuditsChange() {
        this.emit(CHANGE_EVENT_AUDITS);
    }

    addAuditsChangeListener(callback) {
        this.on(CHANGE_EVENT_AUDITS, callback);
    }

    removeAuditsChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_AUDITS, callback);
    }

    emitStatusesChange() {
        this.emit(CHANGE_EVENT_STATUSES);
    }

    addStatusesChangeListener(callback) {
        this.on(CHANGE_EVENT_STATUSES, callback);
    }

    removeStatusesChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_STATUSES, callback);
    }

    // General

    getCurrentUser() {
        return this.getProfiles()[this.currentUserId];
    }

    setCurrentUser(user) {
        this.saveProfile(user);
        this.currentUserId = user.id;
        global.window.mm_current_user_id = this.currentUserId;
        if (LocalizationStore.getLocale() !== user.locale) {
            setTimeout(() => GlobalActions.newLocalizationSelected(user.locale), 0);
        }
    }

    getCurrentId() {
        var user = this.getCurrentUser();

        if (user) {
            return user.id;
        }

        return null;
    }

    // System-Wide Profiles

    saveProfiles(profiles) {
        const newProfiles = Object.assign({}, profiles);
        const currentId = this.getCurrentId();
        if (newProfiles[currentId]) {
            Reflect.deleteProperty(newProfiles, currentId);
        }
        this.profiles = Object.assign({}, this.profiles, newProfiles);
    }

    getProfiles() {
        return this.profiles;
    }

    getProfile(userId) {
        if (this.profiles[userId]) {
            return Object.assign({}, this.profiles[userId]);
        }

        return null;
    }

    getProfileListForIds(userIds, skipCurrent = false, skipInactive = false) {
        const profiles = [];
        const currentId = this.getCurrentId();

        for (let i = 0; i < userIds.length; i++) {
            const profile = this.getProfile(userIds[i]);

            if (!profile) {
                continue;
            }

            if (skipCurrent && profile.id === currentId) {
                continue;
            }

            if (skipInactive && profile.delete_at > 0) {
                continue;
            }

            profiles.push(profile);
        }

        return profiles;
    }

    hasProfile(userId) {
        return this.getProfiles.hasOwnProperty(userId);
    }

    getProfileByUsername(username) {
        return this.getProfilesUsernameMap()[username];
    }

    getProfilesUsernameMap() {
        var profileUsernameMap = {};

        var profiles = this.getProfiles();
        for (var key in profiles) {
            if (profiles.hasOwnProperty(key)) {
                var profile = profiles[key];
                profileUsernameMap[profile.username] = profile;
            }
        }

        return profileUsernameMap;
    }

    getActiveOnlyProfiles(skipCurrent) {
        const active = {};
        const profiles = this.getProfiles();
        const currentId = this.getCurrentId();

        for (var key in profiles) {
            if (!(profiles[key].id === currentId && skipCurrent) && profiles[key].delete_at === 0) {
                active[key] = profiles[key];
            }
        }

        return active;
    }

    getActiveOnlyProfileList() {
        const profileMap = this.getActiveOnlyProfiles();
        const profiles = [];

        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id)) {
                profiles.push(profileMap[id]);
            }
        }

        profiles.sort((a, b) => {
            if (a.username < b.username) {
                return -1;
            }
            if (a.username > b.username) {
                return 1;
            }
            return 0;
        });

        return profiles;
    }

    getProfileList(skipCurrent = false, allowInactive = false) {
        const profiles = [];
        const currentId = this.getCurrentId();

        for (const id in this.profiles) {
            if (this.profiles.hasOwnProperty(id)) {
                var profile = this.profiles[id];

                if (skipCurrent && id === currentId) {
                    continue;
                }

                if (allowInactive || profile.delete_at === 0) {
                    profiles.push(profile);
                }
            }
        }

        profiles.sort((a, b) => {
            if (a.username < b.username) {
                return -1;
            }
            if (a.username > b.username) {
                return 1;
            }
            return 0;
        });

        return profiles;
    }

    saveProfile(profile) {
        this.profiles[profile.id] = profile;
    }

    // Team-Wide Profiles

    saveProfilesInTeam(teamId, profiles) {
        const oldProfileList = this.profiles_in_team[teamId] || [];
        const oldProfileMap = {};
        for (let i = 0; i < oldProfileList.length; i++) {
            oldProfileMap[oldProfileList[i]] = this.getProfile(oldProfileList[i]);
        }

        const newProfileMap = Object.assign({}, oldProfileMap, profiles);
        const newProfileList = Object.keys(newProfileMap);

        newProfileList.sort((a, b) => {
            const aProfile = newProfileMap[a];
            const bProfile = newProfileMap[b];

            if (aProfile.username < bProfile.username) {
                return -1;
            }
            if (aProfile.username > bProfile.username) {
                return 1;
            }
            return 0;
        });

        this.profiles_in_team[teamId] = newProfileList;
        this.saveProfiles(profiles);
    }

    getProfileListInTeam(teamId = TeamStore.getCurrentId(), skipCurrent = false, skipInactive = false) {
        const userIds = this.profiles_in_team[teamId] || [];

        return this.getProfileListForIds(userIds, skipCurrent, skipInactive);
    }

    removeProfileFromTeam(teamId, userId) {
        const userIds = this.profiles_in_team[teamId];
        if (!userIds) {
            return;
        }

        const index = userIds.indexOf(userId);
        if (index === -1) {
            return;
        }

        userIds.splice(index, 1);
    }

    // Channel-Wide Profiles

    saveProfilesInChannel(channelId = ChannelStore.getCurrentId(), profiles) {
        const oldProfileList = this.profiles_in_channel[channelId] || [];
        const oldProfileMap = {};
        for (let i = 0; i < oldProfileList.length; i++) {
            oldProfileMap[oldProfileList[i]] = this.getProfile(oldProfileList[i]);
        }

        const newProfileMap = Object.assign({}, oldProfileMap, profiles);
        const newProfileList = Object.keys(newProfileMap);

        newProfileList.sort((a, b) => {
            const aProfile = newProfileMap[a];
            const bProfile = newProfileMap[b];

            if (aProfile.username < bProfile.username) {
                return -1;
            }
            if (aProfile.username > bProfile.username) {
                return 1;
            }
            return 0;
        });

        this.profiles_in_channel[channelId] = newProfileList;
        this.saveProfiles(profiles);
    }

    saveProfileInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        const profileMap = {};
        profileMap[profile.id] = profile;
        this.saveProfilesInChannel(channelId, profileMap);
    }

    saveUserIdInChannel(channelId = ChannelStore.getCurrentId(), userId) {
        const profile = this.getProfile(userId);

        // Must have profile or we can't sort the list
        if (!profile) {
            return false;
        }

        this.saveProfileInChannel(channelId, profile);

        return true;
    }

    removeProfileInChannel(channelId, userId) {
        const userIds = this.profiles_in_channel[channelId];
        if (!userIds) {
            return;
        }

        const index = userIds.indexOf(userId);
        if (index === -1) {
            return;
        }

        userIds.splice(index, 1);
    }

    getProfileListInChannel(channelId = ChannelStore.getCurrentId(), skipCurrent = false) {
        const userIds = this.profiles_in_channel[channelId] || [];

        return this.getProfileListForIds(userIds, skipCurrent, false);
    }

    saveProfilesNotInChannel(channelId = ChannelStore.getCurrentId(), profiles) {
        const oldProfileList = this.profiles_not_in_channel[channelId] || [];
        const oldProfileMap = {};
        for (let i = 0; i < oldProfileList.length; i++) {
            oldProfileMap[oldProfileList[i]] = this.getProfile(oldProfileList[i]);
        }

        const newProfileMap = Object.assign({}, oldProfileMap, profiles);
        const newProfileList = Object.keys(newProfileMap);

        newProfileList.sort((a, b) => {
            const aProfile = newProfileMap[a];
            const bProfile = newProfileMap[b];

            if (aProfile.username < bProfile.username) {
                return -1;
            }
            if (aProfile.username > bProfile.username) {
                return 1;
            }
            return 0;
        });

        this.profiles_not_in_channel[channelId] = newProfileList;
        this.saveProfiles(profiles);
    }

    saveProfileNotInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        const profileMap = {};
        profileMap[profile.id] = profile;
        this.saveProfilesNotInChannel(channelId, profileMap);
    }

    removeProfileNotInChannel(channelId, userId) {
        const userIds = this.profiles_not_in_channel[channelId];
        if (!userIds) {
            return;
        }

        const index = userIds.indexOf(userId);
        if (index === -1) {
            return;
        }

        userIds.splice(index, 1);
    }

    getProfileListNotInChannel(channelId = ChannelStore.getCurrentId(), skipInactive = false) {
        const userIds = this.profiles_not_in_channel[channelId] || [];

        return this.getProfileListForIds(userIds, false, skipInactive);
    }

    // Profiles without any teams

    saveProfilesWithoutTeam(profiles) {
        const oldProfileList = this.profiles_without_team;
        const oldProfileMap = {};
        for (let i = 0; i < oldProfileList.length; i++) {
            oldProfileMap[oldProfileList[i]] = this.getProfile(oldProfileList[i]);
        }

        const newProfileMap = Object.assign({}, oldProfileMap, profiles);
        const newProfileList = Object.keys(newProfileMap);

        newProfileList.sort((a, b) => {
            const aProfile = newProfileMap[a];
            const bProfile = newProfileMap[b];

            if (aProfile.username < bProfile.username) {
                return -1;
            }
            if (aProfile.username > bProfile.username) {
                return 1;
            }
            return 0;
        });

        this.profiles_without_team = newProfileList;
        this.saveProfiles(profiles);
    }

    getProfileListWithoutTeam(skipCurrent = false, skipInactive = false) {
        const userIds = this.profiles_without_team || [];

        return this.getProfileListForIds(userIds, skipCurrent, skipInactive);
    }

    // Other

    setSessions(sessions) {
        this.sessions = sessions;
    }

    getSessions() {
        return this.sessions;
    }

    setAudits(audits) {
        this.audits = audits;
    }

    getAudits() {
        return this.audits;
    }

    getCurrentMentionKeys() {
        return this.getMentionKeys(this.getCurrentId());
    }

    getMentionKeys(id) {
        var user = this.getProfile(id);

        var keys = [];

        if (!user || !user.notify_props) {
            return keys;
        }

        if (user.notify_props.mention_keys) {
            keys = keys.concat(user.notify_props.mention_keys.split(','));
        }

        if (user.notify_props.first_name === 'true' && user.first_name) {
            keys.push(user.first_name);
        }

        if (user.notify_props.channel === 'true') {
            keys.push('@channel');
            keys.push('@all');
        }

        const usernameKey = '@' + user.username;
        if (keys.indexOf(usernameKey) === -1) {
            keys.push(usernameKey);
        }

        return keys;
    }

    setStatuses(statuses) {
        this.statuses = Object.assign(this.statuses, statuses);
    }

    setStatus(userId, status) {
        this.statuses[userId] = status;
        this.emitStatusesChange();
    }

    getStatuses() {
        return this.statuses;
    }

    getStatus(id) {
        return this.getStatuses()[id] || UserStatuses.OFFLINE;
    }

    getNoAccounts() {
        return this.noAccounts;
    }

    setNoAccounts(noAccounts) {
        this.noAccounts = noAccounts;
    }

    isSystemAdminForCurrentUser() {
        if (!Utils) {
            Utils = require('utils/utils.jsx'); //eslint-disable-line global-require
        }

        var current = this.getCurrentUser();

        if (current) {
            return Utils.isSystemAdmin(current.roles);
        }

        return false;
    }

    setPage(offset, count) {
        this.paging_offset = offset + count;
        this.paging_count = this.paging_count + count;
    }

    getPagingOffset() {
        return this.paging_offset;
    }

    getPagingCount() {
        return this.paging_count;
    }

    setInTeamPage(offset, count) {
        this.in_team_offset = offset + count;
        this.in_team_count = this.in_team_count + count;
    }

    getInTeamPagingOffset() {
        return this.in_team_offset;
    }

    getInTeamPagingCount() {
        return this.in_team_count;
    }

    setInChannelPage(channelId, offset, count) {
        this.in_channel_offset[channelId] = offset + count;
        this.in_channel_count[channelId] = this.dm_paging_count + count;
    }

    getInChannelPagingOffset(channelId) {
        return this.in_channel_offset[channelId] | 0;
    }

    getInChannelPagingCount(channelId) {
        return this.in_channel_count[channelId] | 0;
    }

    setNotInChannelPage(channelId, offset, count) {
        this.not_in_channel_offset[channelId] = offset + count;
        this.not_in_channel_count[channelId] = this.dm_paging_count + count;
    }

    getNotInChannelPagingOffset(channelId) {
        return this.not_in_channel_offset[channelId] | 0;
    }

    getNotInChannelPagingCount(channelId) {
        return this.not_in_channel_count[channelId] | 0;
    }
}

var UserStore = new UserStoreClass();
UserStore.setMaxListeners(600);

UserStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_PROFILES:
        UserStore.saveProfiles(action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setPage(action.offset, action.count);
        }
        UserStore.emitChange();
        break;
    case ActionTypes.RECEIVED_PROFILES_IN_TEAM:
        UserStore.saveProfilesInTeam(action.team_id, action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setInTeamPage(action.offset, action.count);
        }
        UserStore.emitInTeamChange();
        break;
    case ActionTypes.RECEIVED_PROFILES_IN_CHANNEL:
        UserStore.saveProfilesInChannel(action.channel_id, action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setInChannelPage(action.offset, action.count);
        }
        UserStore.emitInChannelChange();
        break;
    case ActionTypes.RECEIVED_PROFILES_NOT_IN_CHANNEL:
        UserStore.saveProfilesNotInChannel(action.channel_id, action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setNotInChannelPage(action.offset, action.count);
        }
        UserStore.emitNotInChannelChange();
        break;
    case ActionTypes.RECEIVED_PROFILES_WITHOUT_TEAM:
        UserStore.saveProfilesWithoutTeam(action.profiles);
        UserStore.emitWithoutTeamChange();
        break;
    case ActionTypes.RECEIVED_PROFILE:
        UserStore.saveProfile(action.profile);
        UserStore.emitChange();
        break;
    case ActionTypes.RECEIVED_ME:
        UserStore.setCurrentUser(action.me);
        UserStore.emitChange(action.me.id);
        break;
    case ActionTypes.RECEIVED_SESSIONS:
        UserStore.setSessions(action.sessions);
        UserStore.emitSessionsChange();
        break;
    case ActionTypes.RECEIVED_AUDITS:
        UserStore.setAudits(action.audits);
        UserStore.emitAuditsChange();
        break;
    case ActionTypes.RECEIVED_STATUSES:
        UserStore.setStatuses(action.statuses);
        UserStore.emitStatusesChange();
        break;
    default:
    }
});

export {UserStore as default};
