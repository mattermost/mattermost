// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {FileTypes} from 'mattermost-redux/action_types';
import {RequestStatus} from 'mattermost-redux/constants';

import {initialRequestState} from './helpers';

export function handleUploadFilesRequest(
    REQUEST: string,
    SUCCESS: string,
    FAILURE: string,
    CANCEL: string,
    state: RequestStatusType,
    action: AnyAction,
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
            error = Object.hasOwn(error, 'intl') ? {...error} : error.toString();
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

function uploadFiles(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleUploadFilesRequest(
        FileTypes.UPLOAD_FILES_REQUEST,
        FileTypes.UPLOAD_FILES_SUCCESS,
        FileTypes.UPLOAD_FILES_FAILURE,
        FileTypes.UPLOAD_FILES_CANCEL,
        state,
        action,
    );
}

export default combineReducers({
    uploadFiles,
});
