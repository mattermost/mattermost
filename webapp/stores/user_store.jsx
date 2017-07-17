// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EventEmitter from 'events';

import Constants from 'utils/constants.jsx';
const UserStatuses = Constants.UserStatuses;

const CHANGE_EVENT_NOT_IN_CHANNEL = 'change_not_in_channel';
const CHANGE_EVENT_IN_CHANNEL = 'change_in_channel';
const CHANGE_EVENT_NOT_IN_TEAM = 'change_not_in_team';
const CHANGE_EVENT_IN_TEAM = 'change_in_team';
const CHANGE_EVENT_WITHOUT_TEAM = 'change_without_team';
const CHANGE_EVENT = 'change';
const CHANGE_EVENT_SESSIONS = 'change_sessions';
const CHANGE_EVENT_AUDITS = 'change_audits';
const CHANGE_EVENT_STATUSES = 'change_statuses';

import store from 'stores/redux_store.jsx';
import * as Selectors from 'mattermost-redux/selectors/entities/users';
import {UserTypes} from 'mattermost-redux/action_types';

import ChannelStore from 'stores/channel_store.jsx';
import TeamStore from 'stores/team_store.jsx';

var Utils;

class UserStoreClass extends EventEmitter {
    constructor() {
        super();

        this.noAccounts = false;
        this.entities = {};

        store.subscribe(() => {
            const newEntities = store.getState().entities.users;

            if (newEntities.profiles !== this.entities.profiles) {
                this.emitChange();
            }
            if (newEntities.profilesInChannel !== this.entities.profilesInChannel) {
                this.emitInChannelChange();
            }
            if (newEntities.profilesNotInChannel !== this.entities.profilesNotInChannel) {
                this.emitNotInChannelChange();
            }
            if (newEntities.profilesInTeam !== this.entities.profilesInTeam) {
                this.emitInTeamChange();
            }
            if (newEntities.profilesNotInTeam !== this.entities.profilesNotInTeam) {
                this.emitNotInTeamChange();
            }
            if (newEntities.profilesWithoutTeam !== this.entities.profilesWithoutTeam) {
                this.emitWithoutTeamChange();
            }
            if (newEntities.statuses !== this.entities.statuses) {
                this.emitStatusesChange();
            }
            if (newEntities.myAudits !== this.entities.myAudits) {
                this.emitAuditsChange();
            }
            if (newEntities.mySessions !== this.entities.mySessions) {
                this.emitSessionsChange();
            }

            this.entities = newEntities;
        });
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

    emitNotInTeamChange() {
        this.emit(CHANGE_EVENT_NOT_IN_TEAM);
    }

    addNotInTeamChangeListener(callback) {
        this.on(CHANGE_EVENT_NOT_IN_TEAM, callback);
    }

    removeNotInTeamChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_NOT_IN_TEAM, callback);
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
        return Selectors.getCurrentUser(store.getState());
    }

    getCurrentId() {
        return Selectors.getCurrentUserId(store.getState());
    }

    // System-Wide Profiles

    getProfiles() {
        return Selectors.getUsers(store.getState());
    }

    getProfile(userId) {
        return Selectors.getUser(store.getState(), userId);
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
        return this.getProfiles().hasOwnProperty(userId);
    }

    getProfileByUsername(username) {
        return this.getProfilesUsernameMap()[username];
    }

    getProfilesUsernameMap() {
        return Selectors.getUsersByUsername(store.getState());
    }

    getProfileByEmail(email) {
        return Selectors.getUsersByEmail(store.getState())[email];
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
        const profileMap = this.getProfiles();

        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id)) {
                var profile = profileMap[id];

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
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE,
            data: profile
        });
    }

    // Team-Wide Profiles

    getProfileListInTeam(teamId = TeamStore.getCurrentId(), skipCurrent = false, skipInactive = false) {
        const userIds = Array.from(Selectors.getUserIdsInTeams(store.getState())[teamId] || []);

        return this.getProfileListForIds(userIds, skipCurrent, skipInactive);
    }

    removeProfileFromTeam(teamId, userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_TEAM,
            data: {user_id: userId},
            id: teamId
        });
    }

    // Not In Team Profiles

    getProfileListNotInTeam(teamId = TeamStore.getCurrentId(), skipCurrent = false, skipInactive = false) {
        const userIds = Array.from(Selectors.getUserIdsNotInTeams(store.getState())[teamId] || []);
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

    removeProfileNotInTeam(teamId, userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_IN_TEAM,
            data: {user_id: userId},
            id: teamId
        });
    }

    // Channel-Wide Profiles

    saveProfileInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
            data: {user_id: profile.id},
            id: channelId
        });
    }

    saveUserIdInChannel(channelId = ChannelStore.getCurrentId(), userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
            data: {user_id: userId},
            id: channelId
        });
    }

    removeProfileInChannel(channelId, userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
            data: {user_id: userId},
            id: channelId
        });
    }

    getProfileListInChannel(channelId = ChannelStore.getCurrentId(), skipCurrent = false, skipInactive = false) {
        const userIds = Array.from(Selectors.getUserIdsInChannels(store.getState())[channelId] || []);

        return this.getProfileListForIds(userIds, skipCurrent, skipInactive);
    }

    saveProfileNotInChannel(channelId = ChannelStore.getCurrentId(), profile) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_NOT_IN_CHANNEL,
            data: {user_id: profile.id},
            id: channelId
        });
    }

    removeProfileNotInChannel(channelId, userId) {
        store.dispatch({
            type: UserTypes.RECEIVED_PROFILE_IN_CHANNEL,
            data: {user_id: userId},
            id: channelId
        });
    }

    getProfileListNotInChannel(channelId = ChannelStore.getCurrentId(), skipInactive = false) {
        const userIds = Array.from(Selectors.getUserIdsNotInChannels(store.getState())[channelId] || []);

        return this.getProfileListForIds(userIds, false, skipInactive);
    }

    // Profiles without any teams

    getProfileListWithoutTeam(skipCurrent = false, skipInactive = false) {
        const userIds = Array.from(Selectors.getUserIdsWithoutTeam(store.getState()) || []);

        return this.getProfileListForIds(userIds, skipCurrent, skipInactive);
    }

    // Other

    getSessions() {
        return store.getState().entities.users.mySessions;
    }

    getAudits() {
        return store.getState().entities.users.myAudits;
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

    setStatus(userId, status) {
        const data = [{user_id: userId, status}];
        store.dispatch({
            type: UserTypes.RECEIVED_STATUSES,
            data
        });
    }

    getStatuses() {
        return store.getState().entities.users.statuses;
    }

    getStatus(id) {
        return this.getStatuses()[id] || UserStatuses.OFFLINE;
    }

    getNoAccounts() {
        return global.window.mm_config.NoAccounts === 'true';
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
}

var UserStore = new UserStoreClass();
UserStore.setMaxListeners(600);

export {UserStore as default};
