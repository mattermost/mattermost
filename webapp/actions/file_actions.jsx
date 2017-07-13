// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {batchActions} from 'redux-batched-actions';
import request from 'superagent';

import store from 'stores/redux_store.jsx';

import * as Utils from 'utils/utils.jsx';

import {FileTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {getLogErrorAction} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';

export function uploadFile(file, name, channelId, clientId, successCallback, errorCallback) {
    const {dispatch, getState} = store;

    function handleResponse(err, res) {
        if (err) {
            let e;
            if (res && res.body && res.body.id) {
                e = res.body;
            } else if (err.status === 0 || !err.status) {
                e = {message: Utils.localizeMessage('channel_loader.connection_error', 'There appears to be a problem with your internet connection.')};
            } else {
                e = {message: Utils.localizeMessage('channel_loader.unknown_error', 'We received an unexpected status code from the server.') + ' (' + err.status + ')'};
            }

            forceLogoutIfNecessary(err, dispatch);

            const failure = {
                type: FileTypes.UPLOAD_FILES_FAILURE,
                clientIds: [clientId],
                channelId,
                rootId: null,
                error: err
            };

            dispatch(batchActions([failure, getLogErrorAction(err)]), getState);

            if (errorCallback) {
                errorCallback(e, err, res);
            }
        } else if (res) {
            const data = res.body.file_infos.map((fileInfo, index) => {
                return {
                    ...fileInfo,
                    clientId: res.body.client_ids[index]
                };
            });

            dispatch(batchActions([
                {
                    type: FileTypes.RECEIVED_UPLOAD_FILES,
                    data,
                    channelId,
                    rootId: null
                },
                {
                    type: FileTypes.UPLOAD_FILES_SUCCESS
                }
            ]), getState);

            if (successCallback) {
                successCallback(res.body, res);
            }
        }
    }

    dispatch({type: FileTypes.UPLOAD_FILES_REQUEST}, getState);

    return request.
        post(Client4.getFilesRoute()).
        set(Client4.getOptions().headers).
        attach('files', file, name).
        field('channel_id', channelId).
        field('client_ids', clientId).
        accept('application/json').
        end(handleResponse);
}

export async function getPublicLink(fileId, success) {
    Client4.getFilePublicLink(fileId).then(
        (data) => {
            if (data && success) {
                success(data.link);
            }
        }
    ).catch(
        () => {} //eslint-disable-line no-empty-function
    );
}
