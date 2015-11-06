// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var BrowserStore = require('./browser_store.jsx');

var CHANGE_EVENT = 'change';
var CHANGE_EVENT_SESSIONS = 'change_sessions';
var CHANGE_EVENT_AUDITS = 'change_audits';
var CHANGE_EVENT_TEAMS = 'change_teams';
var CHANGE_EVENT_STATUSES = 'change_statuses';

class UserStoreClass extends EventEmitter {
    constructor() {
        super();

        this.emitChange = this.emitChange.bind(this);
        this.addChangeListener = this.addChangeListener.bind(this);
        this.removeChangeListener = this.removeChangeListener.bind(this);
        this.emitSessionsChange = this.emitSessionsChange.bind(this);
        this.addSessionsChangeListener = this.addSessionsChangeListener.bind(this);
        this.removeSessionsChangeListener = this.removeSessionsChangeListener.bind(this);
        this.emitAuditsChange = this.emitAuditsChange.bind(this);
        this.addAuditsChangeListener = this.addAuditsChangeListener.bind(this);
        this.removeAuditsChangeListener = this.removeAuditsChangeListener.bind(this);
        this.emitTeamsChange = this.emitTeamsChange.bind(this);
        this.addTeamsChangeListener = this.addTeamsChangeListener.bind(this);
        this.removeTeamsChangeListener = this.removeTeamsChangeListener.bind(this);
        this.emitStatusesChange = this.emitStatusesChange.bind(this);
        this.addStatusesChangeListener = this.addStatusesChangeListener.bind(this);
        this.removeStatusesChangeListener = this.removeStatusesChangeListener.bind(this);
        this.getCurrentId = this.getCurrentId.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.setCurrentUser = this.setCurrentUser.bind(this);
        this.getLastEmail = this.getLastEmail.bind(this);
        this.setLastEmail = this.setLastEmail.bind(this);
        this.hasProfile = this.hasProfile.bind(this);
        this.getProfile = this.getProfile.bind(this);
        this.getProfileByUsername = this.getProfileByUsername.bind(this);
        this.getProfilesUsernameMap = this.getProfilesUsernameMap.bind(this);
        this.getProfiles = this.getProfiles.bind(this);
        this.getActiveOnlyProfiles = this.getActiveOnlyProfiles.bind(this);
        this.getActiveOnlyProfileList = this.getActiveOnlyProfileList.bind(this);
        this.saveProfile = this.saveProfile.bind(this);
        this.setSessions = this.setSessions.bind(this);
        this.getSessions = this.getSessions.bind(this);
        this.setAudits = this.setAudits.bind(this);
        this.getAudits = this.getAudits.bind(this);
        this.setTeams = this.setTeams.bind(this);
        this.getTeams = this.getTeams.bind(this);
        this.getCurrentMentionKeys = this.getCurrentMentionKeys.bind(this);
        this.setStatuses = this.setStatuses.bind(this);
        this.pSetStatuses = this.pSetStatuses.bind(this);
        this.setStatus = this.setStatus.bind(this);
        this.getStatuses = this.getStatuses.bind(this);
        this.getStatus = this.getStatus.bind(this);

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

    hasProfile(userId) {
        return this.getProfiles()[userId] != null;
    }

    getProfile(userId) {
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

    getActiveOnlyProfiles() {
        const active = {};
        const profiles = this.getProfiles();
        const currentId = this.getCurrentId();

        for (var key in profiles) {
            if (profiles[key].delete_at === 0 && profiles[key].id !== currentId) {
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
        var user = this.getCurrentUser();

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
    case ActionTypes.RECIEVED_PROFILES:
        UserStore.saveProfiles(action.profiles);
        UserStore.emitChange();
        break;
    case ActionTypes.RECIEVED_ME:
        UserStore.setCurrentUser(action.me);
        UserStore.emitChange(action.me.id);
        break;
    case ActionTypes.RECIEVED_SESSIONS:
        UserStore.setSessions(action.sessions);
        UserStore.emitSessionsChange();
        break;
    case ActionTypes.RECIEVED_AUDITS:
        UserStore.setAudits(action.audits);
        UserStore.emitAuditsChange();
        break;
    case ActionTypes.RECIEVED_TEAMS:
        UserStore.setTeams(action.teams);
        UserStore.emitTeamsChange();
        break;
    case ActionTypes.RECIEVED_STATUSES:
        UserStore.pSetStatuses(action.statuses);
        UserStore.emitStatusesChange();
        break;
    default:
    }
});

global.window.UserStore = UserStore;
export default UserStore;
