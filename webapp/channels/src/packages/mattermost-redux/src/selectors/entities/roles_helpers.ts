// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Role} from '@mattermost/types/roles';
import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';

export type PermissionsOptions = {
    channel?: string;
    team?: string;
    permission: string;
};

export function getRoles(state: GlobalState) {
    return state.entities.roles.roles;
}

export const getMySystemRoles: (state: GlobalState) => Set<string> = createSelector(
    'getMySystemRoles',
    getCurrentUser,
    (user: UserProfile) => {
        if (user) {
            return new Set<string>(user.roles.split(' '));
        }

        return new Set<string>();
    },
);

export const getMySystemPermissions: (state: GlobalState) => Set<string> = createSelector(
    'getMySystemPermissions',
    getMySystemRoles,
    getRoles,
    (mySystemRoles: Set<string>, allRoles) => {
        return getPermissionsForRoles(allRoles, mySystemRoles);
    },
);

export function haveISystemPermission(state: GlobalState, options: PermissionsOptions) {
    return getMySystemPermissions(state).has(options.permission);
}

export function getPermissionsForRoles(allRoles: Record<string, Role>, roleSet: Set<string>) {
    const permissions = new Set<string>();
    if (!allRoles) {
        return permissions;
    }

    for (const roleName of roleSet) {
        const role = allRoles[roleName];

        if (!role) {
            continue;
        }

        for (const permission of role.permissions) {
            permissions.add(permission);
        }
    }

    return permissions;
}
