// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import BrowserStore from './browser_store.jsx';

const CHANGE_EVENT = 'change';
const CHANGE_EVENT_SESSIONS = 'change_sessions';
const CHANGE_EVENT_AUDITS = 'change_audits';
const CHANGE_EVENT_TEAMS = 'change_teams';
const CHANGE_EVENT_STATUSES = 'change_statuses';

class UserStoreClass extends EventEmitter {
    constructor() {
        super();
        this.profileCache = null;
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

    emitTeamsChange() {
        this.emit(CHANGE_EVENT_TEAMS);
    }

    addTeamsChangeListener(callback) {
        this.on(CHANGE_EVENT_TEAMS, callback);
    }

    removeTeamsChangeListener(callback) {
        this.removeListener(CHANGE_EVENT_TEAMS, callback);
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
        if (this.getProfiles()[global.window.mm_user.id] == null) {
            this.saveProfile(global.window.mm_user);
        }

        return global.window.mm_user;
    }

    setCurrentUser(user) {
        var oldUser = global.window.mm_user;

        if (oldUser.id === user.id) {
            global.window.mm_user = user;
            this.saveProfile(user);
        } else {
            throw new Error('Problem with setCurrentUser old_user_id=' + oldUser.id + ' new_user_id=' + user.id);
        }
    }

    getCurrentId() {
        var user = global.window.mm_user;

        if (user) {
            return user.id;
        }

        return null;
    }

    getLastEmail() {
        return BrowserStore.getGlobalItem('last_email', '');
    }

    setLastEmail(email) {
        BrowserStore.setGlobalItem('last_email', email);
    }

    getLastUsername() {
        return BrowserStore.getGlobalItem('last_username', '');
    }

    setLastUsername(username) {
        BrowserStore.setGlobalItem('last_username', username);
    }

    hasProfile(userId) {
        return this.getProfiles()[userId] != null;
    }

    getProfile(userId) {
        if (userId === this.getCurrentId()) {
            return this.getCurrentUser();
        }

        return this.getProfiles()[userId];
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

    getProfiles() {
        if (this.profileCache !== null) {
            return this.profileCache;
        }

        return BrowserStore.getItem('profiles', {});
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
        const currentId = this.getCurrentId();

        for (const id in profileMap) {
            if (profileMap.hasOwnProperty(id) && id !== currentId) {
                profiles.push(profileMap[id]);
            }
        }

        return profiles;
    }

    saveProfile(profile) {
        var ps = this.getProfiles();
        ps[profile.id] = profile;
        this.profileCache = ps;
        BrowserStore.setItem('profiles', ps);
    }

    saveProfiles(profiles) {
        const currentId = this.getCurrentId();
        if (currentId in profiles) {
            delete profiles[currentId];
        }

        this.profileCache = profiles;
        BrowserStore.setItem('profiles', profiles);
    }

    setSessions(sessions) {
        BrowserStore.setItem('sessions', sessions);
    }

    getSessions() {
        return BrowserStore.getItem('sessions', {loading: true});
    }

    setAudits(audits) {
        BrowserStore.setItem('audits', audits);
    }

    getAudits() {
        return BrowserStore.getItem('audits', {loading: true});
    }

    setTeams(teams) {
        BrowserStore.setItem('teams', teams);
    }

    getTeams() {
        return BrowserStore.getItem('teams', []);
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

        if (user.notify_props.all === 'true') {
            keys.push('@all');
        }

        if (user.notify_props.channel === 'true') {
            keys.push('@channel');
        }

        return keys;
    }

    setStatuses(statuses) {
        this.pSetStatuses(statuses);
        this.emitStatusesChange();
    }

    pSetStatuses(statuses) {
        BrowserStore.setItem('statuses', statuses);
    }

    setStatus(userId, status) {
        var statuses = this.getStatuses();
        statuses[userId] = status;
        this.pSetStatuses(statuses);
        this.emitStatusesChange();
    }

    getStatuses() {
        return BrowserStore.getItem('statuses', {});
    }

    getStatus(id) {
        return this.getStatuses()[id];
    }
}

var UserStore = new UserStoreClass();
UserStore.setMaxListeners(0);

UserStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_PROFILES:
        UserStore.saveProfiles(action.profiles);
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
    case ActionTypes.RECEIVED_TEAMS:
        UserStore.setTeams(action.teams);
        UserStore.emitTeamsChange();
        break;
    case ActionTypes.RECEIVED_STATUSES:
        UserStore.pSetStatuses(action.statuses);
        UserStore.emitStatusesChange();
        break;
    default:
    }
});

export {UserStore as default};
