// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GeneralTypes} from 'mattermost-redux/action_types';

import {GenericAction} from 'mattermost-redux/types/actions';
import {GeneralRequestsStatuses, RequestStatusType} from '@mattermost/types/requests';

import {handleRequest, initialRequestState} from './helpers';

function websocket(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    if (action.type === GeneralTypes.WEBSOCKET_CLOSED) {
        return initialRequestState();
    }

    return handleRequest(
        GeneralTypes.WEBSOCKET_REQUEST,
        GeneralTypes.WEBSOCKET_SUCCESS,
        GeneralTypes.WEBSOCKET_FAILURE,
        state,
        action,
    );
}

export default (combineReducers({
    websocket,
}) as (b: GeneralRequestsStatuses, a: GenericAction) => GeneralRequestsStatuses);
