// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {ClusterInfo, AnalyticsRow, AnalyticsState, AdminState} from '@mattermost/types/admin';
import type {Audit} from '@mattermost/types/audits';
import type {Compliance} from '@mattermost/types/compliance';
import type {AdminConfig, EnvironmentConfig} from '@mattermost/types/config';
import type {DataRetentionCustomPolicy} from '@mattermost/types/data_retention';
import type {MixedUnlinkedGroupRedux} from '@mattermost/types/groups';
import type {PluginRedux, PluginStatusRedux} from '@mattermost/types/plugins';
import type {SamlCertificateStatus, SamlMetadataResponse} from '@mattermost/types/saml';
import type {UserAccessToken, UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne, IDMappedObjects} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {AdminTypes, UserTypes} from 'mattermost-redux/action_types';
import {Stats} from 'mattermost-redux/constants';
import PluginState from 'mattermost-redux/constants/plugins';

function logs(state: string[] = [], action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_LOGS: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function plainLogs(state: string[] = [], action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_PLAIN_LOGS: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function audits(state: Record<string, Audit> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_AUDITS: {
        const nextState = {...state};
        for (const audit of action.data) {
            nextState[audit.id] = audit;
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function config(state: Partial<AdminConfig> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_CONFIG: {
        return action.data;
    }
    case AdminTypes.ENABLED_PLUGIN: {
        const nextPluginSettings = {...state.PluginSettings!};
        const nextPluginStates = {...nextPluginSettings.PluginStates};
        nextPluginStates[action.data] = {Enable: true};
        nextPluginSettings.PluginStates = nextPluginStates;
        return {...state, PluginSettings: nextPluginSettings};
    }
    case AdminTypes.DISABLED_PLUGIN: {
        const nextPluginSettings = {...state.PluginSettings!};
        const nextPluginStates = {...nextPluginSettings.PluginStates};
        nextPluginStates[action.data] = {Enable: false};
        nextPluginSettings.PluginStates = nextPluginStates;
        return {...state, PluginSettings: nextPluginSettings};
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function prevTrialLicense(state: Partial<AdminConfig> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.PREV_TRIAL_LICENSE_SUCCESS: {
        return action.data;
    }
    default:
        return state;
    }
}

function environmentConfig(state: Partial<EnvironmentConfig> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_ENVIRONMENT_CONFIG: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function complianceReports(state: Record<string, Compliance> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_COMPLIANCE_REPORT: {
        const nextState = {...state};
        nextState[action.data.id] = action.data;
        return nextState;
    }
    case AdminTypes.RECEIVED_COMPLIANCE_REPORTS: {
        const nextState = {...state};
        for (const report of action.data) {
            nextState[report.id] = report;
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function clusterInfo(state: ClusterInfo[] = [], action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_CLUSTER_STATUS: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return [];

    default:
        return state;
    }
}

function samlCertStatus(state: Partial<SamlCertificateStatus> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_SAML_CERT_STATUS: {
        return action.data;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

export function convertAnalyticsRowsToStats(data: AnalyticsRow[], name: string): AnalyticsState {
    const stats: AnalyticsState = {};
    const clonedData = [...data];

    if (name === 'post_counts_day') {
        clonedData.reverse();
        stats[Stats.POST_PER_DAY] = clonedData;
        return stats;
    }

    if (name === 'bot_post_counts_day') {
        clonedData.reverse();
        stats[Stats.BOT_POST_PER_DAY] = clonedData;
        return stats;
    }

    if (name === 'user_counts_with_posts_day') {
        clonedData.reverse();
        stats[Stats.USERS_WITH_POSTS_PER_DAY] = clonedData;
        return stats;
    }

    clonedData.forEach((row) => {
        let key;
        switch (row.name) {
        case 'channel_open_count':
            key = Stats.TOTAL_PUBLIC_CHANNELS;
            break;
        case 'channel_private_count':
            key = Stats.TOTAL_PRIVATE_GROUPS;
            break;
        case 'post_count':
            key = Stats.TOTAL_POSTS;
            break;
        case 'unique_user_count':
            key = Stats.TOTAL_USERS;
            break;
        case 'inactive_user_count':
            key = Stats.TOTAL_INACTIVE_USERS;
            break;
        case 'team_count':
            key = Stats.TOTAL_TEAMS;
            break;
        case 'total_websocket_connections':
            key = Stats.TOTAL_WEBSOCKET_CONNECTIONS;
            break;
        case 'total_master_db_connections':
            key = Stats.TOTAL_MASTER_DB_CONNECTIONS;
            break;
        case 'total_read_db_connections':
            key = Stats.TOTAL_READ_DB_CONNECTIONS;
            break;
        case 'daily_active_users':
            key = Stats.DAILY_ACTIVE_USERS;
            break;
        case 'monthly_active_users':
            key = Stats.MONTHLY_ACTIVE_USERS;
            break;
        case 'incoming_webhook_count':
            key = Stats.TOTAL_IHOOKS;
            break;
        case 'outgoing_webhook_count':
            key = Stats.TOTAL_OHOOKS;
            break;
        case 'command_count':
            key = Stats.TOTAL_COMMANDS;
            break;
        case 'session_count':
            key = Stats.TOTAL_SESSIONS;
            break;
        case 'registered_users':
            key = Stats.REGISTERED_USERS;
            break;
        case 'total_file_count':
            key = Stats.TOTAL_FILE_COUNT;
            break;
        case 'total_file_size':
            key = Stats.TOTAL_FILE_SIZE;
            break;
        }

        if (key) {
            stats[key] = row.value;
        }
    });

    return stats;
}

function analytics(state: AdminState['analytics'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_SYSTEM_ANALYTICS: {
        const stats = convertAnalyticsRowsToStats(action.data, action.name);
        return {...state, ...stats};
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function teamAnalytics(state: AdminState['teamAnalytics'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_TEAM_ANALYTICS: {
        const nextState = {...state};
        const stats = convertAnalyticsRowsToStats(action.data, action.name);
        const analyticsForTeam = {...(nextState[action.teamId] || {}), ...stats};
        nextState[action.teamId] = analyticsForTeam;
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function userAccessTokens(state: Record<string, UserAccessToken> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_USER_ACCESS_TOKEN: {
        return {...state, [action.data.id]: action.data};
    }
    case AdminTypes.RECEIVED_USER_ACCESS_TOKENS_FOR_USER: {
        const nextState: any = {};

        for (const uat of action.data) {
            nextState[uat.id] = uat;
        }

        return {...state, ...nextState};
    }
    case UserTypes.REVOKED_USER_ACCESS_TOKEN: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data);
        return {...nextState};
    }
    case UserTypes.ENABLED_USER_ACCESS_TOKEN: {
        const token = {...state[action.data], is_active: true};
        return {...state, [action.data]: token};
    }
    case UserTypes.DISABLED_USER_ACCESS_TOKEN: {
        const token = {...state[action.data], is_active: false};
        return {...state, [action.data]: token};
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function userAccessTokensByUser(state: RelationOneToOne<UserProfile, Record<string, UserAccessToken>> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_USER_ACCESS_TOKEN: { // UserAccessToken
        const nextUserState: UserAccessToken | Record<string, UserAccessToken> = {...(state[action.data.user_id] || {})};
        nextUserState[action.data.id] = action.data;

        return {...state, [action.data.user_id]: nextUserState};
    }
    case AdminTypes.RECEIVED_USER_ACCESS_TOKENS_FOR_USER: { // UserAccessToken[]
        const nextUserState = {...(state[action.userId] || {})};

        for (const uat of action.data) {
            nextUserState[uat.id] = uat;
        }

        return {...state, [action.userId]: nextUserState};
    }
    case UserTypes.REVOKED_USER_ACCESS_TOKEN: {
        const userIds = Object.keys(state);
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            if (state[userId] && state[userId][action.data]) {
                const nextUserState = {...state[userId]};
                Reflect.deleteProperty(nextUserState, action.data);
                return {...state, [userId]: nextUserState};
            }
        }

        return state;
    }
    case UserTypes.ENABLED_USER_ACCESS_TOKEN: {
        const userIds = Object.keys(state);
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            if (state[userId] && state[userId][action.data]) {
                const nextUserState = {...state[userId]};
                const token = {...nextUserState[action.data], is_active: true};
                nextUserState[token.id] = token;
                return {...state, [userId]: nextUserState};
            }
        }

        return state;
    }
    case UserTypes.DISABLED_USER_ACCESS_TOKEN: {
        const userIds = Object.keys(state);
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            if (state[userId] && state[userId][action.data]) {
                const nextUserState = {...state[userId]};
                const token = {...nextUserState[action.data], is_active: false};
                nextUserState[token.id] = token;
                return {...state, [userId]: nextUserState};
            }
        }

        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function plugins(state: Record<string, PluginRedux> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_PLUGINS: {
        const nextState = {...state};
        const activePlugins = action.data.active;
        for (const plugin of activePlugins) {
            nextState[plugin.id] = {...plugin, active: true};
        }

        const inactivePlugins = action.data.inactive;
        for (const plugin of inactivePlugins) {
            nextState[plugin.id] = {...plugin, active: false};
        }
        return nextState;
    }
    case AdminTypes.REMOVED_PLUGIN: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data);
        return nextState;
    }
    case AdminTypes.ENABLED_PLUGIN: {
        const nextState = {...state};
        const plugin = nextState[action.data];
        if (plugin && !plugin.active) {
            nextState[action.data] = {...plugin, active: true};
            return nextState;
        }
        return state;
    }
    case AdminTypes.DISABLED_PLUGIN: {
        const nextState = {...state};
        const plugin = nextState[action.data];
        if (plugin && plugin.active) {
            nextState[action.data] = {...plugin, active: false};
            return nextState;
        }
        return state;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function pluginStatuses(state: Record<string, PluginStatusRedux> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_PLUGIN_STATUSES: {
        const nextState: any = {};

        for (const plugin of (action.data || [])) {
            const id = plugin.plugin_id;

            // The plugin may be in different states across the cluster. Pick the highest one to
            // surface an error.
            const pluginState = Math.max((nextState[id] && nextState[id].state) || 0, plugin.state);

            const instances = [
                ...((nextState[id] && nextState[id].instances) || []),
                {
                    cluster_id: plugin.cluster_id,
                    version: plugin.version,
                    state: plugin.state,
                },
            ];

            nextState[id] = {
                id,
                name: (nextState[id] && nextState[id].name) || plugin.name,
                description: (nextState[id] && nextState[id].description) || plugin.description,
                version: (nextState[id] && nextState[id].version) || plugin.version,
                active: pluginState > 0,
                state: pluginState,
                error: plugin.error,
                instances,
            };
        }

        return nextState;
    }

    case AdminTypes.ENABLE_PLUGIN_REQUEST: {
        const pluginId = action.data;
        if (!state[pluginId]) {
            return state;
        }

        return {
            ...state,
            [pluginId]: {
                ...state[pluginId],
                state: PluginState.PLUGIN_STATE_STARTING,
            },
        };
    }

    case AdminTypes.ENABLE_PLUGIN_FAILURE: {
        const pluginId = action.data;
        if (!state[pluginId]) {
            return state;
        }

        return {
            ...state,
            [pluginId]: {
                ...state[pluginId],
                state: PluginState.PLUGIN_STATE_NOT_RUNNING,
            },
        };
    }

    case AdminTypes.DISABLE_PLUGIN_REQUEST: {
        const pluginId = action.data;
        if (!state[pluginId]) {
            return state;
        }

        return {
            ...state,
            [pluginId]: {
                ...state[pluginId],
                state: PluginState.PLUGIN_STATE_STOPPING,
            },
        };
    }

    case AdminTypes.REMOVED_PLUGIN: {
        const pluginId = action.data;
        if (!state[pluginId]) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, pluginId);

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function ldapGroupsCount(state = 0, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_LDAP_GROUPS:
        return action.data.count;
    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

function ldapGroups(state: Record<string, MixedUnlinkedGroupRedux> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_LDAP_GROUPS: {
        const nextState: any = {};
        for (const group of action.data.groups) {
            nextState[group.primary_key] = group;
        }
        return nextState;
    }
    case AdminTypes.LINKED_LDAP_GROUP: {
        const nextState = {...state};
        if (nextState[action.data.primary_key]) {
            nextState[action.data.primary_key] = action.data;
        }
        return nextState;
    }
    case AdminTypes.UNLINKED_LDAP_GROUP: {
        const nextState = {...state};
        if (nextState[action.data]) {
            nextState[action.data] = {
                ...nextState[action.data],
                mattermost_group_id: undefined,
                has_syncables: undefined,
                failed: false,
            };
        }
        return nextState;
    }
    case AdminTypes.LINK_LDAP_GROUP_FAILURE: {
        const nextState = {...state};
        if (nextState[action.data]) {
            nextState[action.data] = {
                ...nextState[action.data],
                failed: true,
            };
        }
        return nextState;
    }
    case AdminTypes.UNLINK_LDAP_GROUP_FAILURE: {
        const nextState = {...state};
        if (nextState[action.data]) {
            nextState[action.data] = {
                ...nextState[action.data],
                failed: true,
            };
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}

function samlMetadataResponse(state: Partial<SamlMetadataResponse> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_SAML_METADATA_RESPONSE: {
        return action.data;
    }
    default:
        return state;
    }
}

function dataRetentionCustomPolicies(state: IDMappedObjects<DataRetentionCustomPolicy> = {}, action: MMReduxAction): IDMappedObjects<DataRetentionCustomPolicy> {
    switch (action.type) {
    case AdminTypes.CREATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS:
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY:
    case AdminTypes.UPDATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS: {
        return {
            ...state,
            [action.data.id]: action.data,
        };
    }

    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICIES: {
        const nextState = {...state};
        if (action.data.policies) {
            for (const dataRetention of action.data.policies) {
                nextState[dataRetention.id] = dataRetention;
            }
        }
        return nextState;
    }

    case AdminTypes.DELETE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data.id);
        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};

    default:
        return state;
    }
}
function dataRetentionCustomPoliciesCount(state = 0, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICIES:
        return action.data.total_count;
    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

function accessControlPolicies(state: IDMappedObjects<AccessControlPolicy> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.CREATE_ACCESS_CONTROL_POLICY_SUCCESS:
    case AdminTypes.RECEIVED_ACCESS_CONTROL_POLICY:
        return {
            ...state,
            [action.data.id]: action.data,
        };
    case AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES: {
        const nextState: IDMappedObjects<AccessControlPolicy> = {};
        for (const policy of action.data) {
            nextState[policy.id] = policy;
        }
        return nextState;
    }
    case AdminTypes.DELETE_ACCESS_CONTROL_POLICY_SUCCESS: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.data.id);
        return nextState;
    }
    case AdminTypes.RECEIVED_ACCESS_CONTROL_POLICIES_SEARCH: {
        const nextState = {...state};
        for (const policy of action.data) {
            nextState[policy.id] = policy;
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function channelsForAccessControlPolicy(state: Record<string, string[]> = {}, action: MMReduxAction) {
    switch (action.type) {
    case AdminTypes.RECEIVED_ACCESS_CONTROL_CHILD_POLICIES:
        if (action.data) {
            return {...state, ...action.data};
        }
        return state;
    case AdminTypes.ASSIGN_CHANNELS_TO_ACCESS_CONTROL_POLICY_SUCCESS:
        return {
            ...state,
            [action.data.policyId]: action.data.channelIds,
        };
    case AdminTypes.UNASSIGN_CHANNELS_FROM_ACCESS_CONTROL_POLICY_SUCCESS:
        return {
            ...state,
            [action.data.policyId]: action.data.channelIds,
        };
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({

    // array of LogObjects each representing a log entry (JSON)
    logs,

    // array of strings each representing a log entry (legacy) with pagination
    plainLogs,

    // object where every key is an audit id and has an object with audit details
    audits,

    // object representing the server configuration
    config,

    // object representing which fields of the server configuration were set through the environment config
    environmentConfig,

    // object where every key is a report id and has an object with report details
    complianceReports,

    // array of cluster status data
    clusterInfo,

    // object with certificate type as keys and boolean statuses as values
    samlCertStatus,

    // object with analytic categories as types and numbers as values
    analytics,

    // object with team ids as keys and analytics objects as values
    teamAnalytics,

    // object with user ids as keys and objects, with token ids as keys, and
    // user access tokens as values without actual token
    userAccessTokensByUser,

    // object with token ids as keys, and user access tokens as values without actual token
    userAccessTokens,

    // object with plugin ids as keys and objects representing plugin manifests as values
    plugins,

    // object with plugin ids as keys and objects representing plugin statuses across the cluster
    pluginStatuses,

    // object representing the ldap groups
    ldapGroups,

    // total ldap groups
    ldapGroupsCount,

    // object representing the metadata response obtained from the IdP
    samlMetadataResponse,

    // object representing the custom data retention policies
    dataRetentionCustomPolicies,

    // total custom retention policies
    dataRetentionCustomPoliciesCount,

    // the last trial license the server used.
    prevTrialLicense,

    // object with policy ids as keys and objects representing the policies as values
    accessControlPolicies,

    // object with policy ids as keys and arrays of channel ids as values
    channelsForAccessControlPolicy,
});
