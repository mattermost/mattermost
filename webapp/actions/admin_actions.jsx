// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';
import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {updateUserMfa, updateUserPassword} from 'mattermost-redux/actions/users';
import {
    getConfig,
    updateConfig,
    uploadBrandImage as uploadBrandImageRedux,
    reloadConfig as reloadConfigRedux,
    getClusterStatus as getClusterStatusRedux,
    testEmail as testEmailRedux,
    invalidateCaches,
    recycleDatabase,
    testLdap,
    syncLdap,
    getSamlCertificateStatus,
    uploadPublicSamlCertificate as uploadPublicSamlCertificateRedux,
    uploadPrivateSamlCertificate as uploadPrivateSamlCertificateRedux,
    uploadIdpSamlCertificate as uploadIdpSamlCertificateRedux,
    removePublicSamlCertificate as removePublicSamlCertificateRedux,
    removePrivateSamlCertificate as removePrivateSamlCertificateRedux,
    removeIdpSamlCertificate as removeIdpSamlCertificateRedux
} from 'mattermost-redux/actions/admin';

export function saveConfig(config, success, error) {
    updateConfig(config)(dispatch, getState).then(
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
    reloadConfigRedux()(dispatch, getState).then(
        (data) => {
            if (data && success) {
                getConfig()(dispatch, getState);
                success(data);
            } else if (data == null && error) {
                const serverError = getState().requests.admin.reloadConfig.error;
                error({id: serverError.server_error_id, ...serverError});
            }
        }
    );
}

export function adminResetMfa(userId, success, error) {
    updateUserMfa(userId, false)(dispatch, getState).then(
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
    getClusterStatusRedux()(dispatch, getState).then(
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
    testEmailRedux(config)(dispatch, getState).then(
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
    testLdap()(dispatch, getState).then(
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
    invalidateCaches()(dispatch, getState).then(
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
    recycleDatabase()(dispatch, getState).then(
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
    updateUserPassword(userId, '', password)(dispatch, getState).then(
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
    getSamlCertificateStatus()(dispatch, getState).then(
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
    syncLdap()(dispatch, getState).then(
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
    Client.getOAuthAppInfo(
        clientId,
        (data) => {
            if (success) {
                success(data);
            }
        },
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

    Client.allowOAuth2(responseType, clientId, redirectUri, state, scope,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function emailToLdap(loginId, password, token, ldapId, ldapPassword, success, error) {
    Client.emailToLdap(
        loginId,
        password,
        token,
        ldapId,
        ldapPassword,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function emailToOAuth(loginId, password, token, newType, success, error) {
    Client.emailToOAuth(
        loginId,
        password,
        token,
        newType,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function oauthToEmail(email, password, success, error) {
    Client.oauthToEmail(
        email,
        password,
        (data) => {
            if (data.follow_link) {
                browserHistory.push(data.follow_link);
            }

            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function regenerateOAuthAppSecret(oauthAppId, success, error) {
    Client.regenerateOAuthAppSecret(
        oauthAppId,
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function uploadBrandImage(brandImage, success, error) {
    uploadBrandImageRedux(brandImage)(dispatch, getState).then(
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
    Client.uploadLicenseFile(
        file,
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function removeLicenseFile(success, error) {
    Client.removeLicenseFile(
        () => {
            if (success) {
                success();
            }
        },
        (err) => {
            if (error) {
                error(err);
            }
        }
    );
}

export function uploadPublicSamlCertificate(file, success, error) {
    uploadPublicSamlCertificateRedux(file)(dispatch, getState).then(
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
    uploadPrivateSamlCertificateRedux(file)(dispatch, getState).then(
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
    uploadIdpSamlCertificateRedux(file)(dispatch, getState).then(
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
    removePublicSamlCertificateRedux()(dispatch, getState).then(
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
    removePrivateSamlCertificateRedux()(dispatch, getState).then(
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
    removeIdpSamlCertificateRedux()(dispatch, getState).then(
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
