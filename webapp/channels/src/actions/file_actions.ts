// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';

import {FileTypes} from 'mattermost-redux/action_types';
import {getLogErrorAction} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import type {FilePreviewInfo} from 'components/file_preview/file_preview';

import {localizeMessage} from 'utils/utils';

import type {ThunkActionFunc} from 'types/store';

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

export function uploadFile({file, name, type, rootId, channelId, clientId, onProgress, onSuccess, onError}: UploadFile, isBookmark?: boolean): ThunkActionFunc<XMLHttpRequest> {
    return (dispatch, getState) => {
        dispatch({type: FileTypes.UPLOAD_FILES_REQUEST});

        let url = Client4.getFilesRoute();
        if (isBookmark) {
            url += '?bookmark=true';
        }

        const xhr = new XMLHttpRequest();

        xhr.open('POST', url, true);

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
                } else if (xhr.status >= 400 && xhr.readyState === 4) {
                    let errorMessage = '';
                    try {
                        const errorResponse = JSON.parse(xhr.response);
                        errorMessage =
                        (errorResponse?.id && errorResponse?.message) ? localizeMessage({id: errorResponse.id, defaultMessage: errorResponse.message}) : localizeMessage({id: 'file_upload.generic_error', defaultMessage: 'There was a problem uploading your files.'});
                    } catch (e) {
                        errorMessage = localizeMessage({id: 'file_upload.generic_error', defaultMessage: 'There was a problem uploading your files.'});
                    }

                    dispatch({
                        type: FileTypes.UPLOAD_FILES_FAILURE,
                        clientIds: [clientId],
                        channelId,
                        rootId,
                    });

                    onError?.(errorMessage, clientId, channelId, rootId);
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
                    const errorMessage = xhr.status === 0 || !xhr.status ? localizeMessage({id: 'file_upload.generic_error', defaultMessage: 'There was a problem uploading your files.'}) : localizeMessage({id: 'channel_loader.unknown_error', defaultMessage: 'We received an unexpected status code from the server.'}) + ' (' + xhr.status + ')';

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
