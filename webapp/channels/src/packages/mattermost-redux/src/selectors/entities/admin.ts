// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogNodeKey} from '@mattermost/types/admin';
import type {LogObjectWithNode} from '@mattermost/types/admin';
import type {DataRetentionCustomPolicies, DataRetentionCustomPolicy} from '@mattermost/types/data_retention';
import type {PluginStatusRedux} from '@mattermost/types/plugins';
import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';

export function getLogs(state: GlobalState) {
    return state.entities.admin.logs;
}

export function getPlainLogs(state: GlobalState) {
    return state.entities.admin.plainLogs;
}

export const getAllLogsWithNode = createSelector(
    'getAllLogsWithNode',
    getLogs,
    (logsByNode) => Object.entries(logsByNode).flatMap(([node, entries]) =>
        entries.map((entry): LogObjectWithNode => ({...entry, [LogNodeKey]: node})),
    ),
);

// Includes nodes that returned no entries, which the flattened entries can't show
export const getLogNodes = createSelector(
    'getLogNodes',
    getLogs,
    (logs) => Object.keys(logs),
);

// Nodes that returned a full page, so older matching entries were left out
export const getTruncatedLogNodes = createSelector(
    'getTruncatedLogNodes',
    getLogs,
    (logsByNode) => Object.keys(logsByNode).filter((node) => logsByNode[node].length >= General.LOGS_PAGE_SIZE_DEFAULT),
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
