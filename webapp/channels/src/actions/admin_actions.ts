// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClusterInfo} from '@mattermost/types/admin';
import type {StatusOK} from '@mattermost/types/client4';
import type {AdminConfig, AllowedIPRange, FetchIPResponse, RequestLicenseBody} from '@mattermost/types/config';
import type {Job, JobTypeBase} from '@mattermost/types/jobs';
import type {SamlCertificateStatus, SamlMetadataResponse} from '@mattermost/types/saml';
import type {AuthChangeResponse, UserProfile} from '@mattermost/types/users';

import * as AdminActions from 'mattermost-redux/actions/admin';
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {createJob} from 'mattermost-redux/actions/jobs';
import {getServerLimits as getServerLimitsAction} from 'mattermost-redux/actions/limits';
import * as TeamActions from 'mattermost-redux/actions/teams';
import * as UserActions from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';

import {emitUserLoggedOutEvent} from 'actions/global_actions';
import {getOnNavigationConfirmed} from 'selectors/views/admin';
import store from 'stores/redux_store';

import {ActionTypes, JobTypes} from 'utils/constants';

import type {ThunkActionFunc} from 'types/store';
import type {AdminConsolePluginComponent} from 'types/store/plugins';

const dispatch = store.dispatch;

type SuccessCallback<T = StatusOK> = ((data: T) => void) | null | undefined;
type ErrorCallback = ((error: Error & {id: string; server_error_id: string}) => void) | null | undefined;

export async function reloadConfig(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.reloadConfig());
    if (data && success) {
        dispatch(AdminActions.getConfig());
        dispatch(AdminActions.getEnvironmentConfig());
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function adminResetMfa(userId: string, success: SuccessCallback<boolean>, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(UserActions.updateUserMfa(userId, false));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getClusterStatus(success: SuccessCallback<ClusterInfo[]>, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.getClusterStatus());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTest(success: SuccessCallback, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.testLdap());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTestConnection(success: SuccessCallback, error: ErrorCallback, settings: any) {
    const {data, error: err} = await dispatch(AdminActions.testLdapConnection(settings));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTestFilters(success: SuccessCallback, error: ErrorCallback, settings: any) {
    const {data, error: err} = await dispatch(AdminActions.testLdapFilters(settings));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTestAttributes(success: SuccessCallback, error: ErrorCallback, settings: any) {
    const {data, error: err} = await dispatch(AdminActions.testLdapAttributes(settings));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTestGroupAttributes(success: SuccessCallback, error: ErrorCallback, settings: any) {
    const {data, error: err} = await dispatch(AdminActions.testLdapGroupAttributes(settings));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function invalidateAllCaches(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.invalidateCaches());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function recycleDatabaseConnection(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.recycleDatabase());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function adminResetEmail(user: UserProfile, success: SuccessCallback<UserProfile>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(UserActions.patchUser(user));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function samlCertificateStatus(success: SuccessCallback<SamlCertificateStatus>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.getSamlCertificateStatus());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getIPFilters(success: SuccessCallback<AllowedIPRange[]>, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.getIPFilters());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

export async function getCurrentIP(success: SuccessCallback<FetchIPResponse>, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.getCurrentIP());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

export async function applyIPFilters(ipList: AllowedIPRange[], success: SuccessCallback<AllowedIPRange[]>, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.applyIPFilters(ipList));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

export function getOAuthAppInfo(clientId: string) {
    return bindClientFunc({
        clientFunc: Client4.getOAuthAppInfo,
        params: [clientId],
    });
}

export function allowOAuth2({
    responseType,
    clientId,
    redirectUri,
    state,
    scope,
    resource,
    codeChallenge,
    codeChallengeMethod,
}: {
    responseType: string | null;
    clientId: string | null;
    redirectUri: string | null;
    state: string | null;
    scope: string | null;
    resource?: string | null;
    codeChallenge?: string | null;
    codeChallengeMethod?: string | null;
}) {
    return bindClientFunc({
        clientFunc: Client4.authorizeOAuthApp,
        params: [responseType, clientId, redirectUri, state, scope, resource, codeChallenge, codeChallengeMethod],
    });
}

export async function emailToLdap(
    loginId: string,
    password: string,
    token: string | undefined,
    ldapId: string,
    ldapPassword: string,
    success: SuccessCallback<AuthChangeResponse>,
    error: ErrorCallback,
) {
    const {data, error: err} = await dispatch(UserActions.switchEmailToLdap(loginId, password, ldapId, ldapPassword, token));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function emailToOAuth(
    loginId: string,
    password: string,
    token: string | undefined,
    newType: string,
    success: SuccessCallback<AuthChangeResponse>,
    error: ErrorCallback,
) {
    const {data, error: err} = await dispatch(UserActions.switchEmailToOAuth(newType, loginId, password, token));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function oauthToEmail(
    currentService: string,
    email: string,
    password: string,
    success: SuccessCallback<AuthChangeResponse>,
    error: ErrorCallback,
) {
    const {data, error: err} = await dispatch(UserActions.switchOAuthToEmail(currentService, email, password));
    if (data) {
        if (data.follow_link) {
            emitUserLoggedOutEvent(data.follow_link);
        }
        if (success) {
            success(data);
        }
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadBrandImage(brandImage: File, success: SuccessCallback<StatusOK>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadBrandImage(brandImage));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function deleteBrandImage(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.deleteBrandImage());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPublicSamlCertificate(file: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadPublicSamlCertificate(file));
    if (data && success) {
        success('saml-public.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPrivateSamlCertificate(file: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadPrivateSamlCertificate(file));
    if (data && success) {
        success('saml-private.key');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPublicLdapCertificate(file: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadPublicLdapCertificate(file));
    if (data && success) {
        success('ldap-public.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}
export async function uploadPrivateLdapCertificate(file: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadPrivateLdapCertificate(file));
    if (data && success) {
        success('ldap-private.key');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadIdpSamlCertificate(file: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadIdpSamlCertificate(file));
    if (data && success) {
        success('saml-idp.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadAuditCertificate(fileData: File, success: SuccessCallback<string>, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.uploadAuditCertificate(fileData));
    if (data && success) {
        success('audit.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removeAuditCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removeAuditCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePublicSamlCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removePublicSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePrivateSamlCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removePrivateSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePublicLdapCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removePublicLdapCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePrivateLdapCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removePrivateLdapCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removeIdpSamlCertificate(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.removeIdpSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getStandardAnalytics(teamId?: string) {
    await dispatch(AdminActions.getStandardAnalytics(teamId));
}

export async function refreshServerLimits() {
    await dispatch(getServerLimitsAction());
}

export async function getAdvancedAnalytics(teamId?: string) {
    await dispatch(AdminActions.getAdvancedAnalytics(teamId));
}

export async function getBotPostsPerDayAnalytics(teamId?: string) {
    await dispatch(AdminActions.getBotPostsPerDayAnalytics(teamId));
}

export async function getPostsPerDayAnalytics(teamId?: string) {
    await dispatch(AdminActions.getPostsPerDayAnalytics(teamId));
}

export async function getUsersPerDayAnalytics(teamId?: string) {
    await dispatch(AdminActions.getUsersPerDayAnalytics(teamId));
}

export async function elasticsearchTest(config: AdminConfig, success: SuccessCallback, error?: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.testElasticsearch(config));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function testFileStoreConnection(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.testFileStoreConnection());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function elasticsearchPurgeIndexes(success: SuccessCallback, error: ErrorCallback, indexes?: string[]) {
    const {data, error: err} = await dispatch(AdminActions.purgeElasticsearchIndexes(indexes));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function jobCreate(success: SuccessCallback<Job>, error: ErrorCallback, job: JobTypeBase & {data?: any}) {
    const {data, error: err} = await dispatch(createJob(job));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function rebuildChannelsIndex(success: SuccessCallback<void>, error: ErrorCallback) {
    await elasticsearchPurgeIndexes(undefined, error, ['channels']);
    const job = {
        type: JobTypes.ELASTICSEARCH_POST_INDEXING,
        data: {
            index_posts: 'false',
            index_users: 'false',
            index_files: 'false',
            index_channels: 'true',
            sub_type: 'channels_index_rebuild',
        },
    };
    await jobCreate(undefined, error, job);
    success?.();
}

export function setNavigationBlocked(blocked: boolean) {
    return {
        type: ActionTypes.SET_NAVIGATION_BLOCKED,
        blocked,
    };
}

export function deferNavigation(onNavigationConfirmed: () => void) {
    return {
        type: ActionTypes.DEFER_NAVIGATION,
        onNavigationConfirmed,
    };
}

export function cancelNavigation() {
    return {
        type: ActionTypes.CANCEL_NAVIGATION,
    };
}

export function confirmNavigation(): ThunkActionFunc<void> {
    // have to rename these because of lint no-shadow
    return (thunkDispatch, thunkGetState) => {
        const callback = getOnNavigationConfirmed(thunkGetState());

        if (callback) {
            callback();
        }

        thunkDispatch({
            type: ActionTypes.CONFIRM_NAVIGATION,
        });
    };
}

export async function invalidateAllEmailInvites(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(TeamActions.invalidateAllEmailInvites());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function testSmtp(success: SuccessCallback, error: ErrorCallback) {
    const {data, error: err} = await dispatch(AdminActions.testEmail());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function registerAdminConsolePlugin(pluginId: string, reducer: unknown): ThunkActionFunc<void> {
    return (storeDispatch) => {
        storeDispatch({
            type: ActionTypes.RECEIVED_ADMIN_CONSOLE_REDUCER,
            data: {
                pluginId,
                reducer,
            },
        });
    };
}

export function unregisterAdminConsolePlugin(pluginId: string): ThunkActionFunc<void> {
    return (storeDispatch) => {
        storeDispatch({
            type: ActionTypes.REMOVED_ADMIN_CONSOLE_REDUCER,
            data: {
                pluginId,
            },
        });
    };
}

export async function testSiteURL(success: SuccessCallback, error: ErrorCallback, siteURL: string) {
    const {data, error: err} = await dispatch(AdminActions.testSiteURL(siteURL));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function registerAdminConsoleCustomSetting(
    pluginId: string,
    key: string,
    component: React.Component,
    {showTitle}: AdminConsolePluginComponent['options'],
): ThunkActionFunc<void> {
    return (storeDispatch) => {
        storeDispatch({
            type: ActionTypes.RECEIVED_ADMIN_CONSOLE_CUSTOM_COMPONENT,
            data: {
                pluginId,
                key,
                component,
                options: {showTitle},
            },
        });
    };
}

export function registerAdminConsoleCustomSection(
    pluginId: string,
    key: string,
    component: React.Component,
): ThunkActionFunc<void> {
    return (storeDispatch) => {
        storeDispatch({
            type: ActionTypes.RECEIVED_ADMIN_CONSOLE_CUSTOM_SECTION,
            data: {
                pluginId,
                key,
                component,
            },
        });
    };
}

export async function getSamlMetadataFromIdp(
    success: SuccessCallback<SamlMetadataResponse>,
    error: ErrorCallback,
    samlMetadataURL: string,
) {
    const {data, error: err} = await dispatch(AdminActions.getSamlMetadataFromIdp(samlMetadataURL));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function setSamlIdpCertificateFromMetadata(success: SuccessCallback<string>, error: ErrorCallback, certData: string) {
    const {data, error: err} = await dispatch(AdminActions.setSamlIdpCertificateFromMetadata(certData));
    if (data && success) {
        success('saml-idp.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function upgradeToE0() {
    return async () => {
        const data = await Client4.upgradeToEnterprise();
        return data;
    };
}

export function upgradeToE0Status() {
    return async () => {
        const data = await Client4.upgradeToEnterpriseStatus();
        return data;
    };
}

export function isAllowedToUpgradeToEnterprise() {
    return async () => {
        try {
            await Client4.isAllowedToUpgradeToEnterprise();
            return {data: true};
        } catch (error) {
            return {error};
        }
    };
}

export function restartServer() {
    return async () => {
        const data = await Client4.restartServer();
        return data;
    };
}

export function ping(getServerStatus?: boolean, deviceId?: string) {
    return async () => {
        const data = await Client4.ping(getServerStatus, deviceId);
        return data;
    };
}

export function requestTrialLicense(requestLicenseBody: RequestLicenseBody) {
    return async () => {
        try {
            const response = await Client4.requestTrialLicense(requestLicenseBody);
            return {data: response};
        } catch (e) {
            // In the event that the status code returned is 451, this request has been blocked because it originated from an embargoed country_dropdown
            return {error: e.message, data: {status: e.status_code}};
        }
    };
}
