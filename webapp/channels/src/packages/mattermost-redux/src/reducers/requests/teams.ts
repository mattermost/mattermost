// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {TeamTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function getMyTeams(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        TeamTypes.MY_TEAMS_REQUEST,
        TeamTypes.MY_TEAMS_SUCCESS,
        TeamTypes.MY_TEAMS_FAILURE,
        state,
        action,
    );
}

function getTeams(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        TeamTypes.GET_TEAMS_REQUEST,
        TeamTypes.GET_TEAMS_SUCCESS,
        TeamTypes.GET_TEAMS_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    getTeams,
    getMyTeams,
});
