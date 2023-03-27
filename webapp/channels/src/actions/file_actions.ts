// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {FileInfo} from '@mattermost/types/files';
import {ServerError} from '@mattermost/types/errors';

import {FileTypes} from 'mattermost-redux/action_types';
import {getLogErrorAction} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {Client4} from 'mattermost-redux/client';
import {FilePreviewInfo} from 'components/file_preview/file_preview';

import {localizeMessage} from 'utils/utils';

export interface UploadFile {
    file: File;
    name: string;
    type: string;
    rootId: string;
    channelId: string;
    clientId: string;
    onProgress: (filePreviewInfo: FilePreviewInfo) => void;
    onSuccess: (data: any, channelId: string, rootId: string) => void;
    onError: (err: string | ServerError, clientId: string, channelId: string, rootId: string) => void;
}

export function uploadFile({file, name, type, rootId, channelId, clientId, onProgress, onSuccess, onError}: UploadFile) {
    return (dispatch: DispatchFunc, getState: GetStateFunc): XMLHttpRequest => {
        dispatch({type: FileTypes.UPLOAD_FILES_REQUEST});

        const xhr = new XMLHttpRequest();

        xhr.open('POST', Client4.getFilesRoute(), true);

        const client4Headers = Client4.getOptions({method: 'POST'}).headers;
        Object.keys(client4Headers).forEach((client4Header) => {
            const client4HeaderValue = client4Headers[client4Header];
            if (client4HeaderValue) {
                xhr.setRequestHeader(client4Header, client4HeaderValue);
            }
        });

        xhr.setRequestHeader('Accept', 'application/json');

        const formData = new FormData();
        formData.append('channel_id', channelId);
        formData.append('client_ids', clientId);
        formData.append('files', file, name); // appending file in the end for steaming support

        if (onProgress && xhr.upload) {
            xhr.upload.onprogress = (event) => {
                const percent = Math.floor((event.loaded / event.total) * 100);
                const filePreviewInfo = {
                    clientId,
                    name,
                    percent,
                    type,
                } as FilePreviewInfo;
                onProgress(filePreviewInfo);
            };
        }

        if (onSuccess) {
            xhr.onload = () => {
                if (xhr.status === 201 && xhr.readyState === 4) {
                    const response = JSON.parse(xhr.response);
                    const data = response.file_infos.map((fileInfo: FileInfo, index: number) => {
                        return {
                            ...fileInfo,
                            clientId: response.client_ids[index],
                        };
                    });

                    dispatch(batchActions([
                        {
                            type: FileTypes.RECEIVED_UPLOAD_FILES,
                            data,
                            channelId,
                            rootId,
                        },
                        {
                            type: FileTypes.UPLOAD_FILES_SUCCESS,
                        },
                    ]));

                    onSuccess(response, channelId, rootId);
                }
            };
        }

        if (onError) {
            xhr.onerror = () => {
                if (xhr.readyState === 4 && xhr.responseText.length !== 0) {
                    const errorResponse = JSON.parse(xhr.response);

                    forceLogoutIfNecessary(errorResponse, dispatch, getState);

                    const uploadFailureAction = {
                        type: FileTypes.UPLOAD_FILES_FAILURE,
                        clientIds: [clientId],
                        channelId,
                        rootId,
                        error: errorResponse,
                    };

                    dispatch(batchActions([uploadFailureAction, getLogErrorAction(errorResponse)]));
                    onError(errorResponse, clientId, channelId, rootId);
                } else {
                    const errorMessage = xhr.status === 0 || !xhr.status ?
                        localizeMessage('file_upload.generic_error', 'There was a problem uploading your files.') :
                        localizeMessage('channel_loader.unknown_error', 'We received an unexpected status code from the server.') + ' (' + xhr.status + ')';

                    dispatch({
                        type: FileTypes.UPLOAD_FILES_FAILURE,
                        clientIds: [clientId],
                        channelId,
                        rootId,
                    });

                    onError({message: errorMessage}, clientId, channelId, rootId);
                }
            };
        }

        xhr.send(formData);

        return xhr;
    };
}
