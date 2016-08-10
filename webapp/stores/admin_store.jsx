// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import EventEmitter from 'events';

import BrowserStore from 'stores/browser_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

const LOG_CHANGE_EVENT = 'log_change';
const SERVER_AUDIT_CHANGE_EVENT = 'server_audit_change';
const CONFIG_CHANGE_EVENT = 'config_change';
const ALL_TEAMS_EVENT = 'all_team_change';
const SERVER_COMPLIANCE_REPORT_CHANGE_EVENT = 'server_compliance_reports_change';

class AdminStoreClass extends EventEmitter {
    constructor() {
        super();

        this.logs = null;
        this.audits = null;
        this.config = null;
        this.clusterId = null;
        this.teams = {};
        this.complianceReports = null;
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

    emitAuditChange() {
        this.emit(SERVER_AUDIT_CHANGE_EVENT);
    }

    addAuditChangeListener(callback) {
        this.on(SERVER_AUDIT_CHANGE_EVENT, callback);
    }

    removeAuditChangeListener(callback) {
        this.removeListener(SERVER_AUDIT_CHANGE_EVENT, callback);
    }

    emitComplianceReportsChange() {
        this.emit(SERVER_COMPLIANCE_REPORT_CHANGE_EVENT);
    }

    addComplianceReportsChangeListener(callback) {
        this.on(SERVER_COMPLIANCE_REPORT_CHANGE_EVENT, callback);
    }

    removeComplianceReportsChangeListener(callback) {
        this.removeListener(SERVER_COMPLIANCE_REPORT_CHANGE_EVENT, callback);
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

    getClusterId() {
        return this.clusterId;
    }

    saveClusterId(clusterId) {
        this.clusterId = clusterId;
    }

    getLogs() {
        return this.logs;
    }

    saveLogs(logs) {
        this.logs = logs;
    }

    getAudits() {
        return this.audits;
    }

    saveAudits(audits) {
        this.audits = audits;
    }

    getComplianceReports() {
        return this.complianceReports;
    }

    saveComplianceReports(complianceReports) {
        this.complianceReports = complianceReports;
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

    getTeam(id) {
        return this.teams[id];
    }

    getSelectedTeams() {
        const result = BrowserStore.getItem('seleted_teams');
        if (!result) {
            return {};
        }
        return result;
    }

    saveSelectedTeams(teams) {
        BrowserStore.setItem('seleted_teams', teams);
    }
}

var AdminStore = new AdminStoreClass();

AdminStoreClass.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECEIVED_LOGS:
        AdminStore.saveLogs(action.logs);
        AdminStore.emitLogChange();
        break;
    case ActionTypes.RECEIVED_SERVER_AUDITS:
        AdminStore.saveAudits(action.audits);
        AdminStore.emitAuditChange();
        break;
    case ActionTypes.RECEIVED_SERVER_COMPLIANCE_REPORTS:
        AdminStore.saveComplianceReports(action.complianceReports);
        AdminStore.emitComplianceReportsChange();
        break;
    case ActionTypes.RECEIVED_CONFIG:
        AdminStore.saveConfig(action.config);
        AdminStore.saveClusterId(action.clusterId);
        AdminStore.emitConfigChange();
        break;
    case ActionTypes.RECEIVED_ALL_TEAMS:
        AdminStore.saveAllTeams(action.teams);
        AdminStore.emitAllTeamsChange();
        break;
    default:
    }
});

export default AdminStore;
