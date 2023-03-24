// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RequestStatus} from 'mattermost-redux/constants';
import {GenericAction} from 'mattermost-redux/types/actions';
import {RequestStatusType} from '@mattermost/types/requests';
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
