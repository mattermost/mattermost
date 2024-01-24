// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {RoleTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function getRolesByNames(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        RoleTypes.ROLES_BY_NAMES_REQUEST,
        RoleTypes.ROLES_BY_NAMES_SUCCESS,
        RoleTypes.ROLES_BY_NAMES_FAILURE,
        state,
        action,
    );
}

function getRoleByName(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        RoleTypes.ROLE_BY_NAME_REQUEST,
        RoleTypes.ROLE_BY_NAME_SUCCESS,
        RoleTypes.ROLE_BY_NAME_FAILURE,
        state,
        action,
    );
}

function getRole(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        RoleTypes.ROLE_BY_ID_REQUEST,
        RoleTypes.ROLE_BY_ID_SUCCESS,
        RoleTypes.ROLE_BY_ID_FAILURE,
        state,
        action,
    );
}

function editRole(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        RoleTypes.EDIT_ROLE_REQUEST,
        RoleTypes.EDIT_ROLE_SUCCESS,
        RoleTypes.EDIT_ROLE_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    getRolesByNames,
    getRoleByName,
    getRole,
    editRole,
});
