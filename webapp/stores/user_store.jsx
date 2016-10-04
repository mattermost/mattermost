// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import * as GlobalActions from 'actions/global_actions.jsx';
import LocalizationStore from './localization_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
const UserStatuses = Constants.UserStatuses;

const CHANGE_EVENT_DM_LIST = 'change_dm_list';
const CHANGE_EVENT_NOT_IN_CHANNEL = 'change_not_in_channel';
const CHANGE_EVENT_IN_CHANNEL = 'change_in_channel';
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
        this.profiles = {};
        this.paging_offset = 0;
        this.paging_count = 0;

        this.profiles_for_dm_list = {};
        this.dm_paging_offset = 0;
        this.dm_paging_count = 0;

        this.profiles_in_channel = {};
        this.in_channel_offset = {};
        this.in_channel_count = {};

        this.profiles_not_in_channel = {};
        this.not_in_channel_offset = {};
        this.not_in_channel_count = {};

        this.direct_profiles = {};
        this.statuses = {};
        this.sessions = {};
        this.audits = {};
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

    emitDmListChange() {
        this.emit(CHANGE_EVENT_DM_LIST);
    }

    addDmListChangeListener(callback) {
        this.on(CHANGE_EVENT_DM_LIST, callback);
    }

    removeDmListChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_DM_LIST, callback);
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

    hasProfile(userId) {
        return this.getProfile(userId) != null;
    }

    hasTeamProfile(userId) {
        return this.getProfiles()[userId];
    }

    hasDirectProfile(userId) {
        return this.getDirectProfiles()[userId];
    }

    getProfile(userId) {
        if (userId === this.getCurrentId()) {
            return this.getCurrentUser();
        }

        const user = this.getProfiles()[userId];
        if (user) {
            return user;
        }

        return this.getDirectProfiles()[userId];
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

    getProfilesForTeam(skipCurrent) {
        const members = TeamStore.getMembersForTeam();
        const profilesForTeam = [];
        for (let i = 0; i < members.length; i++) {
            if (skipCurrent && members[i].user_id === this.getCurrentId()) {
                continue;
            }
            if (this.profiles[members[i].user_id]) {
                profilesForTeam.push(this.profiles[members[i].user_id]);
            }
        }

        profilesForTeam.sort((a, b) => {
            if (a.username < b.username) {
                return -1;
            }
            if (a.username > b.username) {
                return 1;
            }
            return 0;
        });

        return profilesForTeam;
    }

    getDirectProfiles() {
        return this.direct_profiles;
    }

    saveDirectProfile(profile) {
        this.direct_profiles[profile.id] = profile;
    }

    saveDirectProfiles(profiles) {
        this.direct_profiles = profiles;
    }

    getProfiles() {
        return this.profiles;
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

    getActiveOnlyProfilesForTeam(skipCurrent) {
        const active = {};
        const profiles = this.getProfilesForTeam();
        const currentId = this.getCurrentId();

        for (let i = 0; i < profiles.length; i++) {
            if (!(profiles[i].id === currentId && skipCurrent) && profiles[i].delete_at === 0) {
                active[profiles[i].id] = profiles[i];
            }
        }

        return active;
    }

    getActiveOnlyProfileList() {
        const profileMap = this.getActiveOnlyProfiles();
        const profiles = [];
        const currentId = this.getCurrentId();

        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id) && id !== currentId) {
                profiles.push(profileMap[id]);
            }
        }

        return profiles;
    }

    saveProfile(profile) {
        this.profiles[profile.id] = profile;
    }

    saveProfiles(profiles) {
        const currentId = this.getCurrentId();
        const currentUser = this.profiles[currentId];
        if (currentUser) {
            if (currentId in this.profiles) {
                Reflect.deleteProperty(this.profiles, currentId);
            }

            this.profiles = Object.assign({}, this.profiles, profiles);
            this.profiles[currentId] = currentUser;
        } else {
            this.profiles = Object.assign({}, this.profiles, profiles);
        }
    }

    removeProfileInChannel(channelId, userId) {
        let profile;
        if (channelId in this.profiles_in_channel) {
            profile = this.profiles_in_channel[channelId][userId];
            Reflect.deleteProperty(this.profiles_in_channel[channelId], userId);
        }

        return profile;
    }

    saveProfilesInChannel(channelId = ChannelStore.getCurrentId(), profiles) {
        const oldProfiles = this.profiles_in_channel[channelId] || {};
        this.profiles_in_channel[channelId] = Object.assign({}, oldProfiles, profiles);
    }

    saveProfileInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        if (!this.profiles_in_channel[channelId]) {
            this.profiles_in_channel[channelId] = {};
        }
        this.profiles_in_channel[channelId][profile.id] = profile;
    }

    getProfilesInChannel(channelId = ChannelStore.getCurrentId()) {
        const profileMap = this.profiles_in_channel[channelId];

        if (!profileMap) {
            return [];
        }

        const profiles = [];
        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id)) {
                const profile = profileMap[id];

                if (profile.delete_at === 0) {
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

    removeProfileNotInChannel(channelId, userId) {
        let profile;
        if (channelId in this.profiles_not_in_channel) {
            profile = this.profiles_not_in_channel[channelId][userId];
            Reflect.deleteProperty(this.profiles_not_in_channel[channelId], userId);
        }

        return profile;
    }

    saveProfilesNotInChannel(channelId = ChannelStore.getCurrentId(), profiles) {
        const oldProfiles = this.profiles_not_in_channel[channelId] || {};
        this.profiles_not_in_channel[channelId] = Object.assign({}, oldProfiles, profiles);
    }

    saveProfileNotInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        if (!this.profiles_not_in_channel[channelId]) {
            this.profiles_not_in_channel[channelId] = {};
        }
        this.profiles_not_in_channel[channelId][profile.id] = profile;
    }

    getProfilesNotInChannel(channelId = ChannelStore.getCurrentId()) {
        const currentId = this.getCurrentId();
        const profileMap = this.profiles_not_in_channel[channelId];

        if (!profileMap) {
            return [];
        }

        const profiles = [];
        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id) && id !== currentId) {
                const profile = profileMap[id];

                if (profile.delete_at === 0) {
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

    getProfilesForDmList() {
        const currentId = this.getCurrentId();
        const profiles = [];

        for (const id in this.profiles_for_dm_list) {
            if (this.profiles_for_dm_list.hasOwnProperty(id) && id !== currentId) {
                var profile = this.profiles_for_dm_list[id];

                if (profile.delete_at === 0) {
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

    saveProfilesForDmList(profiles) {
        this.profiles_for_dm_list = Object.assign({}, this.profiles_for_dm_list, profiles);
    }

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
            return Utils.isAdmin(current.roles);
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

    setDMPage(offset, count) {
        this.dm_paging_offset = offset + count;
        this.dm_paging_count = this.dm_paging_count + count;
    }

    getDMPagingOffset() {
        return this.dm_paging_offset;
    }

    getDMPagingCount() {
        return this.dm_paging_count;
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
    case ActionTypes.RECEIVED_PROFILES_FOR_DM_LIST:
        UserStore.saveProfilesForDmList(action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setDMPage(action.offset, action.count);
        }
        UserStore.emitDmListChange();
        break;
    case ActionTypes.RECEIVED_PROFILES:
        UserStore.saveProfiles(action.profiles);
        if (action.offset != null && action.count != null) {
            UserStore.setPage(action.offset, action.count);
        }
        UserStore.emitChange();
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
    case ActionTypes.RECEIVED_PROFILE:
        UserStore.saveProfile(action.profile);
        UserStore.emitChange();
        break;
    case ActionTypes.RECEIVED_DIRECT_PROFILES:
        UserStore.saveDirectProfiles(action.profiles);
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
