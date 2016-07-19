// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';

const ActionTypes = Constants.ActionTypes;

export function listOAuthApps(userId, onSuccess, onError) {
    Client.listOAuthApps(
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OAUTHAPPS,
                userId,
                oauthApps: data
            });

            if (onSuccess) {
                onSuccess(data);
            }
        },
        onError
    );
}

export function deleteOAuthApp(id, userId, onSuccess, onError) {
    Client.deleteOAuthApp(
        id,
        () => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.REMOVED_OAUTHAPP,
                userId,
                id
            });

            if (onSuccess) {
                onSuccess();
            }
        },
        onError
    );
}

export function registerOAuthApp(app, onSuccess, onError) {
    Client.registerOAuthApp(
        app,
        (data) => {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_OAUTHAPP,
                oauthApp: data
            });

            if (onSuccess) {
                onSuccess();
            }
        },
        onError
    );
}