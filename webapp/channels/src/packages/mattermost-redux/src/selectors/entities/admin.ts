// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {DataRetentionCustomPolicies, DataRetentionCustomPolicy} from '@mattermost/types/data_retention';
import {PluginStatusRedux} from '@mattermost/types/plugins';

import {GlobalState} from '@mattermost/types/store';
import {LogObject} from '@mattermost/types/admin';

export function getLogs(state: GlobalState) {
    return state.entities.admin.logs;
}

export function getPlainLogs(state: GlobalState) {
    return state.entities.admin.plainLogs;
}

export const getAllLogs = createSelector(
    'getAllLogs',
    getLogs,
    (logs) => {
        return Object.values(logs).reduce<LogObject[]>((acc, log) => {
            // @ts-expect-error: object that is returned from the server contains an array of logs but ts gets confused that its one log object
            acc.push(...log);
            return acc;
        }, []);
    },
);

export function getAudits(state: GlobalState) {
    return state.entities.admin.audits;
}

export function getConfig(state: GlobalState) {
    return state.entities.admin.config;
}

export function getLdapGroups(state: GlobalState) {
    return state.entities.admin.ldapGroups;
}

export function getLdapGroupsCount(state: GlobalState) {
    return state.entities.admin.ldapGroupsCount;
}

export function getEnvironmentConfig(state: GlobalState) {
    return state.entities.admin.environmentConfig;
}

export function getComplianceReports(state: GlobalState) {
    return state.entities.admin.complianceReports;
}

export function getClusterInfo(state: GlobalState) {
    return state.entities.admin.clusterInfo;
}

export function getUserAccessTokens(state: GlobalState) {
    return state.entities.admin.userAccessTokens;
}

export function getDataRetentionCustomPolicies(state: GlobalState): DataRetentionCustomPolicies {
    return state.entities.admin.dataRetentionCustomPolicies;
}

export function getDataRetentionCustomPoliciesCount(state: GlobalState): number {
    return state.entities.admin.dataRetentionCustomPoliciesCount;
}

export function getDataRetentionCustomPolicy(state: GlobalState, id: string): DataRetentionCustomPolicy | undefined | null {
    const policy = getDataRetentionCustomPolicies(state);
    return policy[id];
}

export function getAdminAnalytics(state: GlobalState) {
    return state.entities.admin.analytics;
}

export function getPluginStatuses(state: GlobalState): Record<string, PluginStatusRedux> | undefined {
    return state.entities.admin.pluginStatuses;
}

export function getPluginStatus(state: GlobalState, id: string): PluginStatusRedux | undefined {
    return getPluginStatuses(state)?.[id];
}
