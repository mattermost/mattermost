// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';

import * as AsyncClient from 'utils/async_client.jsx';

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

export function adminResetMfa(userId, success, error) {
    Client.adminResetMfa(
        userId,
        () => {
            AsyncClient.getUser(userId);

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
