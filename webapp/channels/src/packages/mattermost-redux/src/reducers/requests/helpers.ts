// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {RequestStatus} from 'mattermost-redux/constants';

export function initialRequestState(): RequestStatusType {
    return {
        status: RequestStatus.NOT_STARTED,
        error: null,
    };
}

export function handleRequest(
    REQUEST: string,
    SUCCESS: string,
    FAILURE: string,
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
        return {
            ...state,
            status: RequestStatus.FAILURE,
            error: action.error,
        };
    }
    default:
        return state;
    }
}
