// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FilesRequestsStatuses, RequestStatusType} from '@mattermost/types/requests';
import {combineReducers} from 'redux';

import {FileTypes} from 'mattermost-redux/action_types';
import {RequestStatus} from 'mattermost-redux/constants';
import {GenericAction} from 'mattermost-redux/types/actions';

import {initialRequestState} from './helpers';

export function handleUploadFilesRequest(
    REQUEST: string,
    SUCCESS: string,
    FAILURE: string,
    CANCEL: string,
    state: RequestStatusType,
    action: GenericAction,
): RequestStatusType {
    switch (action.type) {
    case REQUEST:
        return {
            ...state,
            status: RequestStatus.STARTED,
        };
    case SUCCESS:
        return {
            ...state,
            status: RequestStatus.SUCCESS,
            error: null,
        };
    case FAILURE: {
        let error = action.error;

        if (error instanceof Error) {
            error = error.hasOwnProperty('intl') ? {...error} : error.toString();
        }

        return {
            ...state,
            status: RequestStatus.FAILURE,
            error,
        };
    }
    case CANCEL:
        return {
            ...state,
            status: RequestStatus.CANCELLED,
            error: null,
        };
    default:
        return state;
    }
}

function uploadFiles(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleUploadFilesRequest(
        FileTypes.UPLOAD_FILES_REQUEST,
        FileTypes.UPLOAD_FILES_SUCCESS,
        FileTypes.UPLOAD_FILES_FAILURE,
        FileTypes.UPLOAD_FILES_CANCEL,
        state,
        action,
    );
}

export default (combineReducers({
    uploadFiles,
}) as (b: FilesRequestsStatuses, a: GenericAction) => FilesRequestsStatuses);
