// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {RequestStatus} from 'mattermost-redux/constants';
import {UserTypes} from 'mattermost-redux/action_types';

import {GenericAction} from 'mattermost-redux/types/actions';
import {UsersRequestsStatuses, RequestStatusType} from '@mattermost/types/requests';

import {handleRequest, initialRequestState} from './helpers';

function login(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    switch (action.type) {
    case UserTypes.LOGIN_REQUEST:
        return {...state, status: RequestStatus.STARTED};

    case UserTypes.LOGIN_SUCCESS:
        return {...state, status: RequestStatus.SUCCESS, error: null};

    case UserTypes.LOGIN_FAILURE:
        return {...state, status: RequestStatus.FAILURE, error: action.error};

    case UserTypes.LOGOUT_SUCCESS:
        return {...state, status: RequestStatus.NOT_STARTED, error: null};

    default:
        return state;
    }
}

function logout(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    switch (action.type) {
    case UserTypes.LOGOUT_REQUEST:
        return {...state, status: RequestStatus.STARTED};

    case UserTypes.LOGOUT_SUCCESS:
        return {...state, status: RequestStatus.SUCCESS, error: null};

    case UserTypes.LOGOUT_FAILURE:
        return {...state, status: RequestStatus.FAILURE, error: action.error};

    case UserTypes.RESET_LOGOUT_STATE:
        return initialRequestState();

    default:
        return state;
    }
}

function autocompleteUsers(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        UserTypes.AUTOCOMPLETE_USERS_REQUEST,
        UserTypes.AUTOCOMPLETE_USERS_SUCCESS,
        UserTypes.AUTOCOMPLETE_USERS_FAILURE,
        state,
        action,
    );
}

function updateMe(state: RequestStatusType = initialRequestState(), action: GenericAction): RequestStatusType {
    return handleRequest(
        UserTypes.UPDATE_ME_REQUEST,
        UserTypes.UPDATE_ME_SUCCESS,
        UserTypes.UPDATE_ME_FAILURE,
        state,
        action,
    );
}

export default (combineReducers({
    login,
    logout,
    autocompleteUsers,
    updateMe,
}) as (b: UsersRequestsStatuses, a: GenericAction) => UsersRequestsStatuses);
