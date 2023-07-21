// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamsRequestsStatuses, RequestStatusType} from '@mattermost/types/requests';
import {combineReducers} from 'redux';

import {TeamTypes} from 'mattermost-redux/action_types';
import {GenericAction} from 'mattermost-redux/types/actions';

import {handleRequest, initialRequestState} from './helpers';

function getMyTeams(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        TeamTypes.MY_TEAMS_REQUEST,
        TeamTypes.MY_TEAMS_SUCCESS,
        TeamTypes.MY_TEAMS_FAILURE,
        state,
        action,
    );
}

function getTeams(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        TeamTypes.GET_TEAMS_REQUEST,
        TeamTypes.GET_TEAMS_SUCCESS,
        TeamTypes.GET_TEAMS_FAILURE,
        state,
        action,
    );
}

function joinTeam(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        TeamTypes.JOIN_TEAM_REQUEST,
        TeamTypes.JOIN_TEAM_SUCCESS,
        TeamTypes.JOIN_TEAM_FAILURE,
        state,
        action,
    );
}

export default (combineReducers({
    getTeams,
    getMyTeams,
    joinTeam,
}) as (b: TeamsRequestsStatuses, a: GenericAction) => TeamsRequestsStatuses);
