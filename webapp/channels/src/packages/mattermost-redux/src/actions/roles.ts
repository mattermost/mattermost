// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Role} from '@mattermost/types/roles';

import {RoleTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';
import {DispatchFunc, GetStateFunc, ActionFunc} from 'mattermost-redux/types/actions';

import {bindClientFunc} from './helpers';

export function getRolesByNames(rolesNames: string[]) {
    return bindClientFunc({
        clientFunc: Client4.getRolesByNames,
        onRequest: RoleTypes.ROLES_BY_NAMES_REQUEST,
        onSuccess: [RoleTypes.RECEIVED_ROLES, RoleTypes.ROLES_BY_NAMES_SUCCESS],
        onFailure: RoleTypes.ROLES_BY_NAMES_FAILURE,
        params: [
            rolesNames,
        ],
    });
}

export function getRoleByName(roleName: string) {
    return bindClientFunc({
        clientFunc: Client4.getRoleByName,
        onRequest: RoleTypes.ROLE_BY_NAME_REQUEST,
        onSuccess: [RoleTypes.RECEIVED_ROLE, RoleTypes.ROLE_BY_NAME_SUCCESS],
        onFailure: RoleTypes.ROLE_BY_NAME_FAILURE,
        params: [
            roleName,
        ],
    });
}

export function getRole(roleId: string) {
    return bindClientFunc({
        clientFunc: Client4.getRole,
        onRequest: RoleTypes.ROLE_BY_ID_REQUEST,
        onSuccess: [RoleTypes.RECEIVED_ROLE, RoleTypes.ROLE_BY_ID_SUCCESS],
        onFailure: RoleTypes.ROLE_BY_ID_FAILURE,
        params: [
            roleId,
        ],
    });
}

export function editRole(role: Role) {
    return bindClientFunc({
        clientFunc: Client4.patchRole,
        onRequest: RoleTypes.EDIT_ROLE_REQUEST,
        onSuccess: [RoleTypes.RECEIVED_ROLE, RoleTypes.EDIT_ROLE_SUCCESS],
        onFailure: RoleTypes.EDIT_ROLE_FAILURE,
        params: [
            role.id,
            role,
        ],
    });
}

export function setPendingRoles(roles: string[]) {
    return async (dispatch: DispatchFunc) => {
        dispatch({type: RoleTypes.SET_PENDING_ROLES, data: roles});
        return {data: roles};
    };
}

export function loadRolesIfNeeded(roles: Iterable<string>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        let pendingRoles = new Set<string>();

        try {
            pendingRoles = new Set<string>(state.entities.roles.pending);
        } catch (e) {
            // do nothing
        }

        for (const role of roles) {
            pendingRoles.add(role);
        }
        if (!state.entities.general.serverVersion) {
            dispatch(setPendingRoles(Array.from(pendingRoles)));
            setTimeout(() => dispatch(loadRolesIfNeeded([])), 500);
            return {data: []};
        }

        const loadedRoles = getRoles(state);
        const newRoles = new Set<string>();

        for (const role of pendingRoles) {
            if (!loadedRoles[role] && role.trim() !== '') {
                newRoles.add(role);
            }
        }

        if (state.entities.roles.pending) {
            await dispatch(setPendingRoles([]));
        }
        if (newRoles.size > 0) {
            return getRolesByNames(Array.from(newRoles))(dispatch, getState);
        }
        return {data: state.entities.roles.roles};
    };
}

export function convertRolesNamesArrayToString(roles: Role[]): string {
    return roles.map((role) => role.name!).join(' ') ?? '';
}
