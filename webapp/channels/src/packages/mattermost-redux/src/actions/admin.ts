// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {LogFilter} from '@mattermost/types/admin';
import type {
    Channel,
    ChannelSearchOpts,
} from '@mattermost/types/channels';
import type {Compliance} from '@mattermost/types/compliance';
import type {AdminConfig, AllowedIPRange} from '@mattermost/types/config';
import type {
    CreateDataRetentionCustomPolicy,
    DataRetentionCustomPolicies,
    GetDataRetentionCustomPoliciesRequest,
    PatchDataRetentionCustomPolicy,
} from '@mattermost/types/data_retention';
import type {ServerError} from '@mattermost/types/errors';
import type {GroupSearchOpts} from '@mattermost/types/groups';
import type {CompleteOnboardingRequest} from '@mattermost/types/setup';
import type {
    Team,
    TeamSearchOpts,
} from '@mattermost/types/teams';
import type {DeepPartial} from '@mattermost/types/utilities';

import {AdminTypes} from 'mattermost-redux/action_types';
import {getServerLimits} from 'mattermost-redux/actions/limits';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import {General} from '../constants';

export function getLogs({serverNames = [], logLevels = [], dateFrom, dateTo}: LogFilter) {
    const logFilter = {
        server_names: serverNames,
        log_levels: logLevels,
        date_from: dateFrom,
        date_to: dateTo,
    };
    return bindClientFunc({
        clientFunc: Client4.getLogs,
        onSuccess: [AdminTypes.RECEIVED_LOGS],
        params: [
            logFilter,
        ],
    });
}

export function getPlainLogs(page = 0, perPage: number = General.LOGS_PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getPlainLogs,
        onSuccess: [AdminTypes.RECEIVED_PLAIN_LOGS],
        params: [
            page,
            perPage,
        ],
    });
}

export function getAudits(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getAudits,
        onSuccess: [AdminTypes.RECEIVED_AUDITS],
        params: [
            page,
            perPage,
        ],
    });
}

export function getConfig() {
    return bindClientFunc({
        clientFunc: Client4.getConfig,
        onSuccess: [AdminTypes.RECEIVED_CONFIG],
    });
}

export function patchConfig(config: DeepPartial<AdminConfig>) {
    return bindClientFunc({
        clientFunc: Client4.patchConfig,
        onSuccess: [AdminTypes.RECEIVED_CONFIG],
        params: [
            config,
        ],
    });
}

export function reloadConfig() {
    return bindClientFunc({
        clientFunc: Client4.reloadConfig,
    });
}

export function getEnvironmentConfig() {
    return bindClientFunc({
        clientFunc: Client4.getEnvironmentConfig,
        onSuccess: [AdminTypes.RECEIVED_ENVIRONMENT_CONFIG],
    });
}

export function testEmail(config?: AdminConfig) {
    return bindClientFunc({
        clientFunc: Client4.testEmail,
        params: [
            config,
        ],
    });
}

export function testSiteURL(siteURL: string) {
    return bindClientFunc({
        clientFunc: Client4.testSiteURL,
        params: [
            siteURL,
        ],
    });
}

export function testS3Connection(config?: AdminConfig) {
    return bindClientFunc({
        clientFunc: Client4.testS3Connection,
        params: [
            config,
        ],
    });
}

export function invalidateCaches() {
    return bindClientFunc({
        clientFunc: Client4.invalidateCaches,
    });
}

export function recycleDatabase() {
    return bindClientFunc({
        clientFunc: Client4.recycleDatabase,
    });
}

export function createComplianceReport(job: Partial<Compliance>) {
    return bindClientFunc({
        clientFunc: Client4.createComplianceReport,
        onRequest: AdminTypes.CREATE_COMPLIANCE_REQUEST,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORT, AdminTypes.CREATE_COMPLIANCE_SUCCESS],
        onFailure: AdminTypes.CREATE_COMPLIANCE_FAILURE,
        params: [
            job,
        ],
    });
}

export function getComplianceReport(reportId: string) {
    return bindClientFunc({
        clientFunc: Client4.getComplianceReport,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORT],
        params: [
            reportId,
        ],
    });
}

export function getComplianceReports(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT) {
    return bindClientFunc({
        clientFunc: Client4.getComplianceReports,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORTS],
        params: [
            page,
            perPage,
        ],
    });
}

export function uploadBrandImage(imageData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadBrandImage,
        params: [
            imageData,
        ],
    });
}

export function deleteBrandImage() {
    return bindClientFunc({
        clientFunc: Client4.deleteBrandImage,
    });
}

export function getClusterStatus() {
    return bindClientFunc({
        clientFunc: Client4.getClusterStatus,
        onSuccess: [AdminTypes.RECEIVED_CLUSTER_STATUS],
    });
}

export function testLdap() {
    return bindClientFunc({
        clientFunc: Client4.testLdap,
    });
}

export function syncLdap() {
    return bindClientFunc({
        clientFunc: Client4.syncLdap,
    });
}

export function getLdapGroups(page = 0, perPage: number = General.PAGE_SIZE_MAXIMUM, opts: GroupSearchOpts = {q: ''}) {
    return bindClientFunc({
        clientFunc: Client4.getLdapGroups,
        onSuccess: [AdminTypes.RECEIVED_LDAP_GROUPS],
        params: [
            page,
            perPage,
            opts,
        ],
    });
}

export function linkLdapGroup(key: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.linkLdapGroup(key);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch({type: AdminTypes.LINK_LDAP_GROUP_FAILURE, error, data: key});
            dispatch(logError(error as ServerError));
            return {error};
        }

        dispatch({
            type: AdminTypes.LINKED_LDAP_GROUP,
            data: {
                primary_key: key,
                name: data.display_name,
                mattermost_group_id: data.id,
                has_syncables: false,
            },
        });

        return {data: true};
    };
}

export function unlinkLdapGroup(key: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.unlinkLdapGroup(key);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch({type: AdminTypes.UNLINK_LDAP_GROUP_FAILURE, error, data: key});
            dispatch(logError(error as ServerError));
            return {error};
        }

        dispatch({
            type: AdminTypes.UNLINKED_LDAP_GROUP,
            data: key,
        });

        return {data: true};
    };
}

export function getSamlCertificateStatus() {
    return bindClientFunc({
        clientFunc: Client4.getSamlCertificateStatus,
        onSuccess: [AdminTypes.RECEIVED_SAML_CERT_STATUS],
    });
}

export function uploadPublicSamlCertificate(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadPublicSamlCertificate,
        params: [
            fileData,
        ],
    });
}

export function uploadPrivateSamlCertificate(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadPrivateSamlCertificate,
        params: [
            fileData,
        ],
    });
}

export function uploadPublicLdapCertificate(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadPublicLdapCertificate,
        params: [
            fileData,
        ],
    });
}

export function uploadPrivateLdapCertificate(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadPrivateLdapCertificate,
        params: [
            fileData,
        ],
    });
}

export function uploadIdpSamlCertificate(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadIdpSamlCertificate,
        params: [
            fileData,
        ],
    });
}

export function removePublicSamlCertificate() {
    return bindClientFunc({
        clientFunc: Client4.deletePublicSamlCertificate,
    });
}

export function removePrivateSamlCertificate() {
    return bindClientFunc({
        clientFunc: Client4.deletePrivateSamlCertificate,
    });
}

export function removePublicLdapCertificate() {
    return bindClientFunc({
        clientFunc: Client4.deletePublicLdapCertificate,
    });
}

export function removePrivateLdapCertificate() {
    return bindClientFunc({
        clientFunc: Client4.deletePrivateLdapCertificate,
    });
}

export function removeIdpSamlCertificate() {
    return bindClientFunc({
        clientFunc: Client4.deleteIdpSamlCertificate,
    });
}

export function testElasticsearch(config?: AdminConfig) {
    return bindClientFunc({
        clientFunc: Client4.testElasticsearch,
        params: [
            config,
        ],
    });
}

export function purgeElasticsearchIndexes(indexes?: string[]) {
    return bindClientFunc({
        clientFunc: Client4.purgeElasticsearchIndexes,
        params: [
            indexes,
        ],
    });
}

export function uploadLicense(fileData: File) {
    return bindClientFunc({
        clientFunc: Client4.uploadLicense,
        params: [
            fileData,
        ],
    });
}

export function removeLicense(): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.removeLicense();
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        await dispatch(getServerLimits());

        return {data: true};
    };
}

export function getPrevTrialLicense(): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getPrevTrialLicense();
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch({type: AdminTypes.PREV_TRIAL_LICENSE_SUCCESS, data});
        return {data};
    };
}

export function getAnalytics(name: string, teamId = ''): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getAnalytics(name, teamId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        if (teamId === '') {
            dispatch({type: AdminTypes.RECEIVED_SYSTEM_ANALYTICS, data, name});
        } else {
            dispatch({type: AdminTypes.RECEIVED_TEAM_ANALYTICS, data, name, teamId});
        }

        return {data};
    };
}

export function getStandardAnalytics(teamId = '') {
    return getAnalytics('standard', teamId);
}

export function getAdvancedAnalytics(teamId = '') {
    return getAnalytics('extra_counts', teamId);
}

export function getPostsPerDayAnalytics(teamId = '') {
    return getAnalytics('post_counts_day', teamId);
}

export function getBotPostsPerDayAnalytics(teamId = '') {
    return getAnalytics('bot_post_counts_day', teamId);
}

export function getUsersPerDayAnalytics(teamId = '') {
    return getAnalytics('user_counts_with_posts_day', teamId);
}

export function uploadPlugin(fileData: File, force = false): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.uploadPlugin(fileData, force);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        return {data};
    };
}

export function installPluginFromUrl(url: string, force = false): ActionFuncAsync {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.installPluginFromUrl(url, force);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        return {data};
    };
}

export function getPlugins() {
    return bindClientFunc({
        clientFunc: Client4.getPlugins,
        onSuccess: [AdminTypes.RECEIVED_PLUGINS],
    });
}

export function getPluginStatuses() {
    return bindClientFunc({
        clientFunc: Client4.getPluginStatuses,
        onSuccess: [AdminTypes.RECEIVED_PLUGIN_STATUSES],
    });
}

export function removePlugin(pluginId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.removePlugin(pluginId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        dispatch(batchActions([
            {type: AdminTypes.REMOVED_PLUGIN, data: pluginId},
            {type: AdminTypes.DISABLED_PLUGIN, data: pluginId},
        ]));

        return {data: true};
    };
}

export function enablePlugin(pluginId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            await Client4.enablePlugin(pluginId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        dispatch({type: AdminTypes.ENABLED_PLUGIN, data: pluginId});

        return {data: true};
    };
}

export function disablePlugin(pluginId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: AdminTypes.DISABLE_PLUGIN_REQUEST, data: pluginId});

        try {
            await Client4.disablePlugin(pluginId);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error};
        }

        dispatch({type: AdminTypes.DISABLED_PLUGIN, data: pluginId});

        return {data: true};
    };
}

export function getSamlMetadataFromIdp(samlMetadataURL: string) {
    return bindClientFunc({
        clientFunc: Client4.getSamlMetadataFromIdp,
        onSuccess: AdminTypes.RECEIVED_SAML_METADATA_RESPONSE,
        params: [
            samlMetadataURL,
        ],
    });
}

export function setSamlIdpCertificateFromMetadata(certData: string) {
    return bindClientFunc({
        clientFunc: Client4.setSamlIdpCertificateFromMetadata,
        params: [
            certData,
        ],
    });
}

export function getDataRetentionCustomPolicies(page = 0, perPage = 10): ActionFuncAsync<GetDataRetentionCustomPoliciesRequest> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getDataRetentionCustomPolicies(page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICIES,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICIES, data},
        );

        return {data};
    };
}

export function getDataRetentionCustomPolicy(id: string): ActionFuncAsync<DataRetentionCustomPolicies> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getDataRetentionCustomPolicy(id);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY, data},
        );

        return {data};
    };
}

export function deleteDataRetentionCustomPolicy(id: string): ActionFuncAsync<{id: string}> {
    return async (dispatch, getState) => {
        try {
            await Client4.deleteDataRetentionCustomPolicy(id);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.DELETE_DATA_RETENTION_CUSTOM_POLICY_FAILURE,
                    error,
                },
            );
            return {error};
        }
        const data = {
            id,
        };
        dispatch(
            {type: AdminTypes.DELETE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS, data},
        );

        return {data};
    };
}

export function getDataRetentionCustomPolicyTeams(id: string, page = 0, perPage: number = General.TEAMS_CHUNK_SIZE): ActionFuncAsync<Team[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getDataRetentionCustomPolicyTeams(id, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS, data},
        );

        return {data};
    };
}

export function getDataRetentionCustomPolicyChannels(id: string, page = 0, perPage: number = General.TEAMS_CHUNK_SIZE): ActionFuncAsync<{channels: Channel[]; total_count: number}> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getDataRetentionCustomPolicyChannels(id, page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS, data},
        );

        return {data};
    };
}

export function searchDataRetentionCustomPolicyTeams(id: string, term: string, opts: TeamSearchOpts): ActionFuncAsync<DataRetentionCustomPolicies> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchDataRetentionCustomPolicyTeams(id, term, opts);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SEARCH,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SEARCH, data},
        );

        return {data};
    };
}

export function searchDataRetentionCustomPolicyChannels(id: string, term: string, opts: ChannelSearchOpts): ActionFuncAsync<DataRetentionCustomPolicies> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.searchDataRetentionCustomPolicyChannels(id, term, opts);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH,
                    error,
                },
            );
            return {error};
        }

        dispatch(
            {type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH, data},
        );

        return {data};
    };
}

export function createDataRetentionCustomPolicy(policy: CreateDataRetentionCustomPolicy): ActionFuncAsync<DataRetentionCustomPolicies> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.createDataRetentionPolicy(policy);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.CREATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS, data},
        );

        return {data};
    };
}

export function updateDataRetentionCustomPolicy(id: string, policy: PatchDataRetentionCustomPolicy): ActionFuncAsync<DataRetentionCustomPolicies> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.updateDataRetentionPolicy(id, policy);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            return {error};
        }

        dispatch(
            {type: AdminTypes.UPDATE_DATA_RETENTION_CUSTOM_POLICY_SUCCESS, data},
        );

        return {data};
    };
}

export function addDataRetentionCustomPolicyTeams(id: string, teams: string[]) {
    return bindClientFunc({
        clientFunc: Client4.addDataRetentionPolicyTeams,
        onSuccess: AdminTypes.ADD_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SUCCESS,
        params: [
            id,
            teams,
        ],
    });
}

export function removeDataRetentionCustomPolicyTeams(id: string, teams: string[]): ActionFuncAsync<{teams: string[]}> {
    return async (dispatch, getState) => {
        try {
            await Client4.removeDataRetentionPolicyTeams(id, teams);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_TEAMS_FAILURE,
                    error,
                },
            );
            return {error};
        }
        const data = {
            teams,
        };
        dispatch(
            {type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SUCCESS, data},
        );

        return {data};
    };
}

export function addDataRetentionCustomPolicyChannels(id: string, channels: string[]) {
    return bindClientFunc({
        clientFunc: Client4.addDataRetentionPolicyChannels,
        onSuccess: AdminTypes.ADD_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS,
        params: [
            id,
            channels,
        ],
    });
}

export function removeDataRetentionCustomPolicyChannels(id: string, channels: string[]): ActionFuncAsync<{channels: string[]}> {
    return async (dispatch, getState) => {
        try {
            await Client4.removeDataRetentionPolicyChannels(id, channels);
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(
                {
                    type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_FAILURE,
                    error,
                },
            );
            return {error};
        }
        const data = {
            channels,
        };
        dispatch(
            {type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS, data},
        );

        return {data};
    };
}

export function completeSetup(completeSetup: CompleteOnboardingRequest) {
    return bindClientFunc({
        clientFunc: Client4.completeSetup,
        params: [completeSetup],
    });
}

export function getAppliedSchemaMigrations() {
    return bindClientFunc({
        clientFunc: Client4.getAppliedSchemaMigrations,
    });
}

export function getIPFilters() {
    return bindClientFunc({
        clientFunc: Client4.getIPFilters,
        params: [],
    });
}

export function getCurrentIP() {
    return bindClientFunc({
        clientFunc: Client4.getCurrentIP,
        params: [],
    });
}

export function applyIPFilters(ipFilters: AllowedIPRange[]) {
    return bindClientFunc({
        clientFunc: Client4.applyIPFilters,
        params: [ipFilters],
    });
}
