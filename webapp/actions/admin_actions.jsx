// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import {browserHistory} from 'react-router/es6';

// Redux actions
import store from 'stores/redux_store.jsx';
const dispatch = store.dispatch;
const getState = store.getState;

import {getUser} from 'mattermost-redux/actions/users';

export function revokeSession(altId, success, error) {
    Client.revokeSession(altId,
        () => {
            AsyncClient.getSessions();
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

export function saveConfig(config, success, error) {
    Client.saveConfig(
        config,
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

export function reloadConfig(success, error) {
    Client.reloadConfig(
        () => {
            AsyncClient.getConfig();
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

export function adminResetMfa(userId, success, error) {
    Client.adminResetMfa(
        userId,
        () => {
            getUser(userId)(dispatch, getState);

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

export function getClusterStatus(success, error) {
    Client.getClusterStatus(
        (data) => {
            if (success) {
                success(data);
            }
        },
        (err) => {
            AsyncClient.dispatchError(err, 'getClusterStatus');
            if (error) {
                error(err);
            }
        }
    );
}

export function saveComplianceReports(job, success, error) {
    Client.saveComplianceReports(
        job,
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

export function testEmail(config, success, error) {
    Client.testEmail(
        config,
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

export function ldapTest(success, error) {
    Client.ldapTest(
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

export function invalidateAllCaches(success, error) {
    Client.invalidateAllCaches(
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

export function recycleDatabaseConnection(success, error) {
    Client.recycleDatabaseConnection(
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

export function adminResetPassword(userId, password, success, error) {
    Client.adminResetPassword(
        userId,
        password,
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

export function samlCertificateStatus(success, error) {
    Client.samlCertificateStatus(
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

export function ldapSyncNow(success, error) {
    Client.ldapSyncNow(
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
    Client.uploadBrandImage(
        brandImage,
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

export function uploadCertificateFile(certificateFile, success, error) {
    Client.uploadCertificateFile(
        certificateFile,
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

export function removeCertificateFile(certificateId, success, error) {
    Client.removeCertificateFile(
        certificateId,
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
