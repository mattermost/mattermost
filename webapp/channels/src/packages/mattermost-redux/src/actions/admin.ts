// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {AnalyticsRow, ClusterInfo, LogFilter, SchemaMigration} from '@mattermost/types/admin';
import type {Audit} from '@mattermost/types/audits';
import type {
    Channel,
    ChannelSearchOpts,
} from '@mattermost/types/channels';
import type {Compliance} from '@mattermost/types/compliance';
import type {AdminConfig, AllowedIPRange, ClientLicense, EnvironmentConfig, License} from '@mattermost/types/config';
import type {
    CreateDataRetentionCustomPolicy,
    DataRetentionCustomPolicies,
    GetDataRetentionCustomPoliciesRequest,
    PatchDataRetentionCustomPolicy,
} from '@mattermost/types/data_retention';
import type {ServerError} from '@mattermost/types/errors';
import type {GroupSearchOpts, MixedUnlinkedGroup} from '@mattermost/types/groups';
import type {PluginManifest, PluginsResponse, PluginStatus} from '@mattermost/types/plugins';
import type {SamlCertificateStatus, SamlMetadataResponse} from '@mattermost/types/saml';
import type {CompleteOnboardingRequest} from '@mattermost/types/setup';
import type {
    Team,
    TeamSearchOpts,
} from '@mattermost/types/teams';

import {AdminTypes} from 'mattermost-redux/action_types';
import {getUsersLimits} from 'mattermost-redux/actions/limits';
import {Client4} from 'mattermost-redux/client';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import {General} from '../constants';

export function getLogs({serverNames = [], logLevels = [], dateFrom, dateTo}: LogFilter): NewActionFuncAsync<string[]> {
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
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getPlainLogs(page = 0, perPage: number = General.LOGS_PAGE_SIZE_DEFAULT): NewActionFuncAsync<string[]> {
    return bindClientFunc({
        clientFunc: Client4.getPlainLogs,
        onSuccess: [AdminTypes.RECEIVED_PLAIN_LOGS],
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAudits(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Audit[]> {
    return bindClientFunc({
        clientFunc: Client4.getAudits,
        onSuccess: [AdminTypes.RECEIVED_AUDITS],
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getConfig(): NewActionFuncAsync<AdminConfig> {
    return bindClientFunc({
        clientFunc: Client4.getConfig,
        onSuccess: [AdminTypes.RECEIVED_CONFIG],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function updateConfig(config: Record<string, unknown>): NewActionFuncAsync<Partial<AdminConfig>> {
    return bindClientFunc({
        clientFunc: Client4.updateConfig,
        onSuccess: [AdminTypes.RECEIVED_CONFIG],
        params: [
            config,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function reloadConfig(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.reloadConfig,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getEnvironmentConfig(): NewActionFuncAsync<EnvironmentConfig> {
    return bindClientFunc({
        clientFunc: Client4.getEnvironmentConfig,
        onSuccess: [AdminTypes.RECEIVED_ENVIRONMENT_CONFIG],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function testEmail(config: unknown): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.testEmail,
        params: [
            config,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function testSiteURL(siteURL: string): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.testSiteURL,
        params: [
            siteURL,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function testS3Connection(config: unknown): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.testS3Connection,
        params: [
            config,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function invalidateCaches(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.invalidateCaches,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function recycleDatabase(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.recycleDatabase,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function createComplianceReport(job: Partial<Compliance>): NewActionFuncAsync<Compliance> {
    return bindClientFunc({
        clientFunc: Client4.createComplianceReport,
        onRequest: AdminTypes.CREATE_COMPLIANCE_REQUEST,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORT, AdminTypes.CREATE_COMPLIANCE_SUCCESS],
        onFailure: AdminTypes.CREATE_COMPLIANCE_FAILURE,
        params: [
            job,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getComplianceReport(reportId: string): NewActionFuncAsync<Compliance> { // HARRISONTODO remove me
    return bindClientFunc({
        clientFunc: Client4.getComplianceReport,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORT],
        params: [
            reportId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getComplianceReports(page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Compliance[]> {
    return bindClientFunc({
        clientFunc: Client4.getComplianceReports,
        onSuccess: [AdminTypes.RECEIVED_COMPLIANCE_REPORTS],
        params: [
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadBrandImage(imageData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadBrandImage,
        params: [
            imageData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function deleteBrandImage(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deleteBrandImage,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getClusterStatus(): NewActionFuncAsync<ClusterInfo[]> {
    return bindClientFunc({
        clientFunc: Client4.getClusterStatus,
        onSuccess: [AdminTypes.RECEIVED_CLUSTER_STATUS],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function testLdap(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.testLdap,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function syncLdap(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.syncLdap,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getLdapGroups(page = 0, perPage: number = General.PAGE_SIZE_MAXIMUM, opts: GroupSearchOpts = {q: ''}): NewActionFuncAsync<{count: number; groups: MixedUnlinkedGroup[]}> {
    return bindClientFunc({
        clientFunc: Client4.getLdapGroups,
        onSuccess: [AdminTypes.RECEIVED_LDAP_GROUPS],
        params: [
            page,
            perPage,
            opts,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function linkLdapGroup(key: string): NewActionFuncAsync {
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

export function unlinkLdapGroup(key: string): NewActionFuncAsync {
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

export function getSamlCertificateStatus(): NewActionFuncAsync<SamlCertificateStatus> {
    return bindClientFunc({
        clientFunc: Client4.getSamlCertificateStatus,
        onSuccess: [AdminTypes.RECEIVED_SAML_CERT_STATUS],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadPublicSamlCertificate(fileData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadPublicSamlCertificate,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadPrivateSamlCertificate(fileData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadPrivateSamlCertificate,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadPublicLdapCertificate(fileData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadPublicLdapCertificate,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadPrivateLdapCertificate(fileData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadPrivateLdapCertificate,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadIdpSamlCertificate(fileData: File): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.uploadIdpSamlCertificate,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removePublicSamlCertificate(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deletePublicSamlCertificate,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removePrivateSamlCertificate(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deletePrivateSamlCertificate,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removePublicLdapCertificate(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deletePublicLdapCertificate,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removePrivateLdapCertificate(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deletePrivateLdapCertificate,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeIdpSamlCertificate(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.deleteIdpSamlCertificate,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function testElasticsearch(config: unknown): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.testElasticsearch,
        params: [
            config,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function purgeElasticsearchIndexes(): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.purgeElasticsearchIndexes,
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function uploadLicense(fileData: File): NewActionFuncAsync<License> {
    return bindClientFunc({
        clientFunc: Client4.uploadLicense,
        params: [
            fileData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeLicense(): NewActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.removeLicense();
        } catch (error) {
            forceLogoutIfNecessary(error as ServerError, dispatch, getState);
            dispatch(logError(error as ServerError));
            return {error: error as ServerError};
        }

        await dispatch(getUsersLimits());

        return {data: true};
    };
}

export function getPrevTrialLicense(): NewActionFuncAsync<ClientLicense> {
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

export function getAnalytics(name: string, teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
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

export function getStandardAnalytics(teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
    return getAnalytics('standard', teamId);
}

export function getAdvancedAnalytics(teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
    return getAnalytics('extra_counts', teamId);
}

export function getPostsPerDayAnalytics(teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
    return getAnalytics('post_counts_day', teamId);
}

export function getBotPostsPerDayAnalytics(teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
    return getAnalytics('bot_post_counts_day', teamId);
}

export function getUsersPerDayAnalytics(teamId = ''): NewActionFuncAsync<AnalyticsRow[]> {
    return getAnalytics('user_counts_with_posts_day', teamId);
}

export function uploadPlugin(fileData: File, force = false): NewActionFuncAsync<PluginManifest> {
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

export function installPluginFromUrl(url: string, force = false): NewActionFuncAsync<PluginManifest> {
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

export function getPlugins(): NewActionFuncAsync<PluginsResponse> {
    return bindClientFunc({
        clientFunc: Client4.getPlugins,
        onSuccess: [AdminTypes.RECEIVED_PLUGINS],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getPluginStatuses(): NewActionFuncAsync<PluginStatus[]> {
    return bindClientFunc({
        clientFunc: Client4.getPluginStatuses,
        onSuccess: [AdminTypes.RECEIVED_PLUGIN_STATUSES],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removePlugin(pluginId: string): NewActionFuncAsync {
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

export function enablePlugin(pluginId: string): NewActionFuncAsync {
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

export function disablePlugin(pluginId: string): NewActionFuncAsync {
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

export function getSamlMetadataFromIdp(samlMetadataURL: string): NewActionFuncAsync<SamlMetadataResponse> {
    return bindClientFunc({
        clientFunc: Client4.getSamlMetadataFromIdp,
        onSuccess: AdminTypes.RECEIVED_SAML_METADATA_RESPONSE,
        params: [
            samlMetadataURL,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function setSamlIdpCertificateFromMetadata(certData: string): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.setSamlIdpCertificateFromMetadata,
        params: [
            certData,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function sendWarnMetricAck(warnMetricId: string, forceAck: boolean): NewActionFuncAsync {
    return async (dispatch) => {
        try {
            Client4.trackEvent('api', 'api_request_send_metric_ack', {warnMetricId});
            await Client4.sendWarnMetricAck(warnMetricId, forceAck);
            return {data: true};
        } catch (e) {
            dispatch(logError(e as ServerError));
            return {error: (e as ServerError).message};
        }
    };
}

export function getDataRetentionCustomPolicies(page = 0, perPage = 10): NewActionFuncAsync<GetDataRetentionCustomPoliciesRequest> {
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

export function getDataRetentionCustomPolicy(id: string): NewActionFuncAsync<DataRetentionCustomPolicies> {
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

export function deleteDataRetentionCustomPolicy(id: string): NewActionFuncAsync<{id: string}> {
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

export function getDataRetentionCustomPolicyTeams(id: string, page = 0, perPage: number = General.TEAMS_CHUNK_SIZE): NewActionFuncAsync<Team[]> {
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

export function getDataRetentionCustomPolicyChannels(id: string, page = 0, perPage: number = General.TEAMS_CHUNK_SIZE): NewActionFuncAsync<{channels: Channel[]; total_count: number}> {
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

export function searchDataRetentionCustomPolicyTeams(id: string, term: string, opts: TeamSearchOpts): NewActionFuncAsync<DataRetentionCustomPolicies> {
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

export function searchDataRetentionCustomPolicyChannels(id: string, term: string, opts: ChannelSearchOpts): NewActionFuncAsync<DataRetentionCustomPolicies> {
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

export function createDataRetentionCustomPolicy(policy: CreateDataRetentionCustomPolicy): NewActionFuncAsync<DataRetentionCustomPolicies> {
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

export function updateDataRetentionCustomPolicy(id: string, policy: PatchDataRetentionCustomPolicy): NewActionFuncAsync<DataRetentionCustomPolicies> {
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

export function addDataRetentionCustomPolicyTeams(id: string, teams: string[]): NewActionFuncAsync<DataRetentionCustomPolicies> {
    return bindClientFunc({
        clientFunc: Client4.addDataRetentionPolicyTeams,
        onSuccess: AdminTypes.ADD_DATA_RETENTION_CUSTOM_POLICY_TEAMS_SUCCESS,
        params: [
            id,
            teams,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeDataRetentionCustomPolicyTeams(id: string, teams: string[]): NewActionFuncAsync<{teams: string[]}> {
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

export function addDataRetentionCustomPolicyChannels(id: string, channels: string[]): NewActionFuncAsync<DataRetentionCustomPolicies> {
    return bindClientFunc({
        clientFunc: Client4.addDataRetentionPolicyChannels,
        onSuccess: AdminTypes.ADD_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS,
        params: [
            id,
            channels,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function removeDataRetentionCustomPolicyChannels(id: string, channels: string[]): NewActionFuncAsync<{channels: string[]}> {
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

export function completeSetup(completeSetup: CompleteOnboardingRequest): NewActionFuncAsync {
    return bindClientFunc({
        clientFunc: Client4.completeSetup,
        params: [completeSetup],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getAppliedSchemaMigrations(): NewActionFuncAsync<SchemaMigration[]> {
    return bindClientFunc({
        clientFunc: Client4.getAppliedSchemaMigrations,
    }) as any; // HARRISONTODO Type bindClientFunc
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
