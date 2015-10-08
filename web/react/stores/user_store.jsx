// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var client = require('../utils/client.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var BrowserStore = require('./browser_store.jsx');

var CHANGE_EVENT = 'change';
var CHANGE_EVENT_SESSIONS = 'change_sessions';
var CHANGE_EVENT_AUDITS = 'change_audits';
var CHANGE_EVENT_TEAMS = 'change_teams';
var CHANGE_EVENT_STATUSES = 'change_statuses';
var TOGGLE_IMPORT_MODAL_EVENT = 'toggle_import_modal';

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
        this.emitToggleImportModal = this.emitToggleImportModal.bind(this);
        this.addImportModalListener = this.addImportModalListener.bind(this);
        this.removeImportModalListener = this.removeImportModalListener.bind(this);
        this.setCurrentId = this.setCurrentId.bind(this);
        this.getCurrentId = this.getCurrentId.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.setCurrentUser = this.setCurrentUser.bind(this);
        this.getLastEmail = this.getLastEmail.bind(this);
        this.setLastEmail = this.setLastEmail.bind(this);
        this.removeCurrentUser = this.removeCurrentUser.bind(this);
        this.hasProfile = this.hasProfile.bind(this);
        this.getProfile = this.getProfile.bind(this);
        this.getProfileByUsername = this.getProfileByUsername.bind(this);
        this.getProfilesUsernameMap = this.getProfilesUsernameMap.bind(this);
        this.getProfiles = this.getProfiles.bind(this);
        this.getActiveOnlyProfiles = this.getActiveOnlyProfiles.bind(this);
        this.saveProfile = this.saveProfile.bind(this);
        this.pStoreProfiles = this.pStoreProfiles.bind(this);
        this.pGetProfiles = this.pGetProfiles.bind(this);
        this.pGetProfilesUsernameMap = this.pGetProfilesUsernameMap.bind(this);
        this.setSessions = this.setSessions.bind(this);
        this.getSessions = this.getSessions.bind(this);
        this.setAudits = this.setAudits.bind(this);
        this.getAudits = this.getAudits.bind(this);
        this.setTeams = this.setTeams.bind(this);
        this.getTeams = this.getTeams.bind(this);
        this.getCurrentMentionKeys = this.getCurrentMentionKeys.bind(this);
        this.getLastVersion = this.getLastVersion.bind(this);
        this.setLastVersion = this.setLastVersion.bind(this);
        this.setStatuses = this.setStatuses.bind(this);
        this.pSetStatuses = this.pSetStatuses.bind(this);
        this.setStatus = this.setStatus.bind(this);
        this.getStatuses = this.getStatuses.bind(this);
        this.getStatus = this.getStatus.bind(this);

        this.gCurrentId = null;
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
    emitToggleImportModal(value) {
        this.emit(TOGGLE_IMPORT_MODAL_EVENT, value);
    }
    addImportModalListener(callback) {
        this.on(TOGGLE_IMPORT_MODAL_EVENT, callback);
    }
    removeImportModalListener(callback) {
        this.removeListener(TOGGLE_IMPORT_MODAL_EVENT, callback);
    }
    setCurrentId(id) {
        this.gCurrentId = id;
        if (id == null) {
            BrowserStore.removeGlobalItem('current_user_id');
        } else {
            BrowserStore.setGlobalItem('current_user_id', id);
        }
    }
    getCurrentId(skipFetch) {
        var currentId = this.gCurrentId;

        if (currentId == null) {
            currentId = BrowserStore.getGlobalItem('current_user_id');
            this.gCurrentId = currentId;
        }

        // this is a special case to force fetch the
        // current user if it's missing
        // it's synchronous to block rendering
        if (currentId == null && !skipFetch) {
            var me = client.getMeSynchronous();
            if (me != null) {
                this.setCurrentUser(me);
                currentId = me.id;
            }
        }

        return currentId;
    }
    getCurrentUser() {
        if (this.getCurrentId() == null) {
            return null;
        }

        return this.pGetProfiles()[this.getCurrentId()];
    }
    setCurrentUser(user) {
        this.setCurrentId(user.id);
        this.saveProfile(user);
    }
    getLastEmail() {
        return BrowserStore.getItem('last_email', '');
    }
    setLastEmail(email) {
        BrowserStore.setItem('last_email', email);
    }
    removeCurrentUser() {
        this.setCurrentId(null);
    }
    hasProfile(userId) {
        return this.pGetProfiles()[userId] != null;
    }
    getProfile(userId) {
        return this.pGetProfiles()[userId];
    }
    getProfileByUsername(username) {
        return this.pGetProfilesUsernameMap()[username];
    }
    getProfilesUsernameMap() {
        return this.pGetProfilesUsernameMap();
    }
    getProfiles() {
        return this.pGetProfiles();
    }
    getActiveOnlyProfiles() {
        var active = {};
        var current = this.pGetProfiles();

        for (var key in current) {
            if (current[key].delete_at === 0) {
                active[key] = current[key];
            }
        }

        return active;
    }
    saveProfile(profile) {
        var ps = this.pGetProfiles();
        ps[profile.id] = profile;
        this.pStoreProfiles(ps);
    }
    pStoreProfiles(profiles) {
        BrowserStore.setItem('profiles', profiles);
        var profileUsernameMap = {};
        for (var id in profiles) {
            if (profiles.hasOwnProperty(id)) {
                profileUsernameMap[profiles[id].username] = profiles[id];
            }
        }
        BrowserStore.setItem('profileUsernameMap', profileUsernameMap);
    }
    pGetProfiles() {
        return BrowserStore.getItem('profiles', {});
    }
    pGetProfilesUsernameMap() {
        return BrowserStore.getItem('profileUsernameMap', {});
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
    getLastVersion() {
        return BrowserStore.getItem('last_version', '');
    }
    setLastVersion(version) {
        BrowserStore.setItem('last_version', version);
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

UserStore.dispatchToken = AppDispatcher.register(function registry(payload) {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_PROFILES:
        for (var id in action.profiles) {
            // profiles can have incomplete data, so don't overwrite current user
            if (id === UserStore.getCurrentId()) {
                continue;
            }
            var profile = action.profiles[id];
            UserStore.saveProfile(profile);
            UserStore.emitChange(profile.id);
        }
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
    case ActionTypes.TOGGLE_IMPORT_THEME_MODAL:
        UserStore.emitToggleImportModal(action.value);
        break;

    default:
    }
});

global.window.UserStore = UserStore;
export default UserStore;
