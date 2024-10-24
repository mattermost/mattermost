// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as AdminActions from 'mattermost-redux/actions/admin';
import {bindClientFunc} from 'mattermost-redux/actions/helpers';
import {createJob} from 'mattermost-redux/actions/jobs';
import * as TeamActions from 'mattermost-redux/actions/teams';
import * as UserActions from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';

import {emitUserLoggedOutEvent} from 'actions/global_actions';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {getOnNavigationConfirmed} from 'selectors/views/admin';
import store from 'stores/redux_store';

import {ActionTypes, JobTypes} from 'utils/constants';

const dispatch = store.dispatch;

export async function reloadConfig(success, error) {
    const {data, error: err} = await dispatch(AdminActions.reloadConfig());
    if (data && success) {
        dispatch(AdminActions.getConfig());
        dispatch(AdminActions.getEnvironmentConfig());
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function adminResetMfa(userId, success, error) {
    const {data, error: err} = await dispatch(UserActions.updateUserMfa(userId, false));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getClusterStatus(success, error) {
    const {data, error: err} = await dispatch(AdminActions.getClusterStatus());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function ldapTest(success, error) {
    const {data, error: err} = await dispatch(AdminActions.testLdap());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function invalidateAllCaches(success, error) {
    const {data, error: err} = await dispatch(AdminActions.invalidateCaches());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function recycleDatabaseConnection(success, error) {
    const {data, error: err} = await dispatch(AdminActions.recycleDatabase());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function adminResetEmail(user, success, error) {
    const {data, error: err} = await dispatch(UserActions.patchUser(user));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function samlCertificateStatus(success, error) {
    const {data, error: err} = await dispatch(AdminActions.getSamlCertificateStatus());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getIPFilters(success, error) {
    const {data, error: err} = await dispatch(AdminActions.getIPFilters());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

export async function getCurrentIP(success, error) {
    const {data, error: err} = await dispatch(AdminActions.getCurrentIP());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

export async function applyIPFilters(ipList, success, error) {
    const {data, error: err} = await dispatch(AdminActions.applyIPFilters(ipList));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error(err);
    }
}

/**
 * @param {string | null} clientId
 * @returns {ActionResult<OAuthApp>}
 */
export function getOAuthAppInfo(clientId) {
    return bindClientFunc({
        clientFunc: Client4.getOAuthAppInfo,
        params: [clientId],
    });
}

/**
 * @param {*}
 * @returns {ActionResult<{redirect: string}>}
 */
export function allowOAuth2({responseType, clientId, redirectUri, state, scope}) {
    return bindClientFunc({
        clientFunc: Client4.authorizeOAuthApp,
        params: [responseType, clientId, redirectUri, state, scope],
    });
}

export async function emailToLdap(loginId, password, token, ldapId, ldapPassword, success, error) {
    const {data, error: err} = await dispatch(UserActions.switchEmailToLdap(loginId, password, ldapId, ldapPassword, token));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function emailToOAuth(loginId, password, token, newType, success, error) {
    const {data, error: err} = await dispatch(UserActions.switchEmailToOAuth(newType, loginId, password, token));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function oauthToEmail(currentService, email, password, success, error) {
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

export async function uploadBrandImage(brandImage, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadBrandImage(brandImage));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function deleteBrandImage(success, error) {
    const {data, error: err} = await dispatch(AdminActions.deleteBrandImage());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPublicSamlCertificate(file, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadPublicSamlCertificate(file));
    if (data && success) {
        success('saml-public.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPrivateSamlCertificate(file, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadPrivateSamlCertificate(file));
    if (data && success) {
        success('saml-private.key');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadPublicLdapCertificate(file, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadPublicLdapCertificate(file));
    if (data && success) {
        success('ldap-public.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}
export async function uploadPrivateLdapCertificate(file, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadPrivateLdapCertificate(file));
    if (data && success) {
        success('ldap-private.key');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function uploadIdpSamlCertificate(file, success, error) {
    const {data, error: err} = await dispatch(AdminActions.uploadIdpSamlCertificate(file));
    if (data && success) {
        success('saml-idp.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePublicSamlCertificate(success, error) {
    const {data, error: err} = await dispatch(AdminActions.removePublicSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePrivateSamlCertificate(success, error) {
    const {data, error: err} = await dispatch(AdminActions.removePrivateSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePublicLdapCertificate(success, error) {
    const {data, error: err} = await dispatch(AdminActions.removePublicLdapCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removePrivateLdapCertificate(success, error) {
    const {data, error: err} = await dispatch(AdminActions.removePrivateLdapCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function removeIdpSamlCertificate(success, error) {
    const {data, error: err} = await dispatch(AdminActions.removeIdpSamlCertificate());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function getStandardAnalytics(teamId) {
    await dispatch(AdminActions.getStandardAnalytics(teamId));
}

export async function getAdvancedAnalytics(teamId) {
    await dispatch(AdminActions.getAdvancedAnalytics(teamId));
}

export async function getBotPostsPerDayAnalytics(teamId) {
    await dispatch(AdminActions.getBotPostsPerDayAnalytics(teamId));
}

export async function getPostsPerDayAnalytics(teamId) {
    await dispatch(AdminActions.getPostsPerDayAnalytics(teamId));
}

export async function getUsersPerDayAnalytics(teamId) {
    await dispatch(AdminActions.getUsersPerDayAnalytics(teamId));
}

export async function elasticsearchTest(config, success, error) {
    const {data, error: err} = await dispatch(AdminActions.testElasticsearch(config));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function testS3Connection(success, error) {
    const {data, error: err} = await dispatch(AdminActions.testS3Connection());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function elasticsearchPurgeIndexes(success, error, indexes) {
    const {data, error: err} = await dispatch(AdminActions.purgeElasticsearchIndexes(indexes));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function jobCreate(success, error, job) {
    const {data, error: err} = await dispatch(createJob(job));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function rebuildChannelsIndex(success, error) {
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
    success();
}

export async function blevePurgeIndexes(success, error) {
    const purgeBleveIndexes = bindClientFunc({
        clientFunc: Client4.purgeBleveIndexes,
        params: [],
    });

    const {data, error: err} = await dispatch(purgeBleveIndexes);
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function setNavigationBlocked(blocked) {
    return {
        type: ActionTypes.SET_NAVIGATION_BLOCKED,
        blocked,
    };
}

export function deferNavigation(onNavigationConfirmed) {
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

export function confirmNavigation() {
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

export async function invalidateAllEmailInvites(success, error) {
    const {data, error: err} = await dispatch(TeamActions.invalidateAllEmailInvites());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function testSmtp(success, error) {
    const {data, error: err} = await dispatch(AdminActions.testEmail());
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function registerAdminConsolePlugin(pluginId, reducer) {
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

export function unregisterAdminConsolePlugin(pluginId) {
    return (storeDispatch) => {
        storeDispatch({
            type: ActionTypes.REMOVED_ADMIN_CONSOLE_REDUCER,
            data: {
                pluginId,
            },
        });
    };
}

export async function testSiteURL(success, error, siteURL) {
    const {data, error: err} = await dispatch(AdminActions.testSiteURL(siteURL));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function registerAdminConsoleCustomSetting(pluginId, key, component, {showTitle}) {
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

export async function getSamlMetadataFromIdp(success, error, samlMetadataURL) {
    const {data, error: err} = await dispatch(AdminActions.getSamlMetadataFromIdp(samlMetadataURL));
    if (data && success) {
        success(data);
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export async function setSamlIdpCertificateFromMetadata(success, error, certData) {
    const {data, error: err} = await dispatch(AdminActions.setSamlIdpCertificateFromMetadata(certData));
    if (data && success) {
        success('saml-idp.crt');
    } else if (err && error) {
        error({id: err.server_error_id, ...err});
    }
}

export function upgradeToE0() {
    return async () => {
        trackEvent('api', 'upgrade_to_e0_requested');
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

export function restartServer() {
    return async () => {
        const data = await Client4.restartServer();
        return data;
    };
}

export function ping(getServerStatus, deviceId) {
    return async () => {
        const data = await Client4.ping(getServerStatus, deviceId);
        return data;
    };
}

export function requestTrialLicense(requestLicenseBody, page) {
    return async () => {
        try {
            trackEvent('api', 'api_request_trial_license', {from_page: page});

            const response = await Client4.requestTrialLicense(requestLicenseBody);
            return {data: response};
        } catch (e) {
            // In the event that the status code returned is 451, this request has been blocked because it originated from an embargoed country_dropdown
            return {error: e.message, data: {status: e.status_code}};
        }
    };
}
