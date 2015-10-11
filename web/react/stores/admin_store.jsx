// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;

var BrowserStore = require('../stores/browser_store.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var LOG_CHANGE_EVENT = 'log_change';
var CONFIG_CHANGE_EVENT = 'config_change';
var ALL_TEAMS_EVENT = 'all_team_change';

class AdminStoreClass extends EventEmitter {
    constructor() {
        super();

        this.logs = null;
        this.config = null;
        this.teams = null;

        this.emitLogChange = this.emitLogChange.bind(this);
        this.addLogChangeListener = this.addLogChangeListener.bind(this);
        this.removeLogChangeListener = this.removeLogChangeListener.bind(this);

        this.emitConfigChange = this.emitConfigChange.bind(this);
        this.addConfigChangeListener = this.addConfigChangeListener.bind(this);
        this.removeConfigChangeListener = this.removeConfigChangeListener.bind(this);

        this.emitAllTeamsChange = this.emitAllTeamsChange.bind(this);
        this.addAllTeamsChangeListener = this.addAllTeamsChangeListener.bind(this);
        this.removeAllTeamsChangeListener = this.removeAllTeamsChangeListener.bind(this);
    }

    emitLogChange() {
        this.emit(LOG_CHANGE_EVENT);
    }

    addLogChangeListener(callback) {
        this.on(LOG_CHANGE_EVENT, callback);
    }

    removeLogChangeListener(callback) {
        this.removeListener(LOG_CHANGE_EVENT, callback);
    }

    emitConfigChange() {
        this.emit(CONFIG_CHANGE_EVENT);
    }

    addConfigChangeListener(callback) {
        this.on(CONFIG_CHANGE_EVENT, callback);
    }

    removeConfigChangeListener(callback) {
        this.removeListener(CONFIG_CHANGE_EVENT, callback);
    }

    emitAllTeamsChange() {
        this.emit(ALL_TEAMS_EVENT);
    }

    addAllTeamsChangeListener(callback) {
        this.on(ALL_TEAMS_EVENT, callback);
    }

    removeAllTeamsChangeListener(callback) {
        this.removeListener(ALL_TEAMS_EVENT, callback);
    }

    getLogs() {
        return this.logs;
    }

    saveLogs(logs) {
        this.logs = logs;
    }

    getConfig() {
        return this.config;
    }

    saveConfig(config) {
        this.config = config;
    }

    getAllTeams() {
        return this.teams;
    }

    saveAllTeams(teams) {
        this.teams = teams;
    }

    getSelectedTeams() {
        return BrowserStore.getItem('seleted_teams');
    }

    saveSelectedTeams(teams) {
        BrowserStore.setItem('seleted_teams', teams);
    }
}

var AdminStore = new AdminStoreClass();

AdminStoreClass.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIEVED_LOGS:
        AdminStore.saveLogs(action.logs);
        AdminStore.emitLogChange();
        break;
    case ActionTypes.RECIEVED_CONFIG:
        AdminStore.saveConfig(action.config);
        AdminStore.emitConfigChange();
        break;
    case ActionTypes.RECIEVED_ALL_TEAMS:
        AdminStore.saveAllTeams(action.teams);
        AdminStore.emitAllTeamsChange();
        break;
    default:
    }
});

export default AdminStore;
