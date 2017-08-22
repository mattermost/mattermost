// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {clientLogout} from 'actions/global_actions.jsx';

import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import * as AdminActions from 'mattermost-redux/actions/admin';
import * as UserActions from 'mattermost-redux/actions/users';
import * as IntegrationActions from 'mattermost-redux/actions/integrations';
import {Client4} from 'mattermost-redux/client';

export function saveConfig(config, success, error) {
    AdminActions.updateConfig(config)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.updateConfig.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function reloadConfig(success, error) {
    AdminActions.reloadConfig()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                AdminActions.getConfig()(dispatch, getState);
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.reloadConfig.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function adminResetMfa(userId, success, error) {
    UserActions.updateUserMfa(userId, false)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getClusterStatus(success, error) {
    AdminActions.getClusterStatus()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.getClusterStatus.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function testEmail(config, success, error) {
    AdminActions.testEmail(config)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.testEmail.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function ldapTest(success, error) {
    AdminActions.testLdap()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.testLdap.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function invalidateAllCaches(success, error) {
    AdminActions.invalidateCaches()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.invalidateCaches.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function recycleDatabaseConnection(success, error) {
    AdminActions.recycleDatabase()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.recycleDatabase.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function adminResetPassword(userId, password, success, error) {
    UserActions.updateUserPassword(userId, '', password)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.updateUser.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function samlCertificateStatus(success, error) {
    AdminActions.getSamlCertificateStatus()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.getSamlCertificateStatus.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function ldapSyncNow(success, error) {
    AdminActions.syncLdap()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.syncLdap.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getOAuthAppInfo(clientId, success, error) {
    Client4.getOAuthAppInfo(clientId).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    ).catch(
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function allowOAuth2(params, success, error) {
    const responseType = params.response_type;
    const clientId = params.client_id;
    const redirectUri = params.redirect_uri;
    const state = params.state;
    const scope = params.scope;

    Client4.authorizeOAuthApp(responseType, clientId, redirectUri, state, scope).then(
        (data) => {
            if (success) {
                success(data);
            }
        }
    ).catch(
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function emailToLdap(loginId, password, token, ldapId, ldapPassword, success, error) {
    UserActions.switchEmailToLdap(loginId, password, ldapId, ldapPassword, token)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.switchLogin.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function emailToOAuth(loginId, password, token, newType, success, error) {
    UserActions.switchEmailToOAuth(newType, loginId, password, token)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.users.switchLogin.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function oauthToEmail(currentService, email, password, success, error) {
    UserActions.switchOAuthToEmail(currentService, email, password)(dispatch, getState).then(
        (data) => {
            if (data) {
                if (data.follow_link) {
                    clientLogout(data.follow_link);
                }
                if (success) {
                    success(data);
                }
            } else if (data == null && error) {
                const serverError = getState().requests.users.switchLogin.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function regenerateOAuthAppSecret(oauthAppId, success, error) {
    IntegrationActions.regenOAuthAppSecret(oauthAppId)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.updateOAuthApp.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function uploadBrandImage(brandImage, success, error) {
    AdminActions.uploadBrandImage(brandImage)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.uploadBrandImage.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function uploadLicenseFile(file, success, error) {
    AdminActions.uploadLicense(file)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.uploadLicense.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function removeLicenseFile(success, error) {
    AdminActions.removeLicense()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.removeLicense.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function uploadPublicSamlCertificate(file, success, error) {
    AdminActions.uploadPublicSamlCertificate(file)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.uploadPublicSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function uploadPrivateSamlCertificate(file, success, error) {
    AdminActions.uploadPrivateSamlCertificate(file)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.uploadPrivateSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function uploadIdpSamlCertificate(file, success, error) {
    AdminActions.uploadIdpSamlCertificate(file)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.uploadIdpSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function removePublicSamlCertificate(success, error) {
    AdminActions.removePublicSamlCertificate()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.removePublicSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function removePrivateSamlCertificate(success, error) {
    AdminActions.removePrivateSamlCertificate()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.removePrivateSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function removeIdpSamlCertificate(success, error) {
    AdminActions.removeIdpSamlCertificate()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.removeIdpSamlCertificate.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function getStandardAnalytics(teamId) {
    AdminActions.getStandardAnalytics(teamId)(dispatch, getState);
}

export function getAdvancedAnalytics(teamId) {
    AdminActions.getAdvancedAnalytics(teamId)(dispatch, getState);
}

export function getPostsPerDayAnalytics(teamId) {
    AdminActions.getPostsPerDayAnalytics(teamId)(dispatch, getState);
}

export function getUsersPerDayAnalytics(teamId) {
    AdminActions.getUsersPerDayAnalytics(teamId)(dispatch, getState);
}

export function elasticsearchTest(config, success, error) {
    AdminActions.testElasticsearch(config)(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.testElasticsearch.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function elasticsearchPurgeIndexes(success, error) {
    AdminActions.purgeElasticsearchIndexes()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.purgeElasticsearchIndexes.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}
