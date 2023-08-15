// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import {
    getMySystemPermissions,
    getMySystemRoles,
    getPermissionsForRoles,
    getRoles,
    haveISystemPermission,
} from 'mattermost-redux/selectors/entities/roles_helpers';
import {getTeamMemberships, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {General, Permissions} from 'mattermost-redux/constants';

import {Role} from '@mattermost/types/roles';
import {GlobalState} from '@mattermost/types/store';
import {GroupMembership, GroupPermissions} from '@mattermost/types/groups';

export {getMySystemPermissions, getMySystemRoles, getRoles, haveISystemPermission};

export const getGroupMemberships: (state: GlobalState) => Record<string, GroupMembership> = createSelector(
    'getGroupMemberships',
    (state) => state.entities.groups.myGroups,
    getCurrentUserId,
    (myGroupIDs: string[], currentUserID: string) => {
        const groupMemberships: Record<string, GroupMembership> = {};
        myGroupIDs.forEach((groupID) => {
            groupMemberships[groupID] = {user_id: currentUserID, roles: General.CUSTOM_GROUP_USER_ROLE};
        });
        return groupMemberships;
    },
);

export const getMyGroupRoles: (state: GlobalState) => Record<string, Set<string>> = createSelector(
    'getMyGroupRoles',
    getGroupMemberships,
    (groupMemberships) => {
        const roles: Record<string, Set<string>> = {};
        if (groupMemberships) {
            for (const key in groupMemberships) {
                if (groupMemberships.hasOwnProperty(key) && groupMemberships[key].roles) {
                    roles[key] = new Set<string>(groupMemberships[key].roles.split(' '));
                }
            }
        }
        return roles;
    },
);

/**
 * Returns a map of permissions, keyed by group id, for all groups that are mentionable and not deleted.
 */
export const getGroupListPermissions: (state: GlobalState) => Record<string, GroupPermissions> = createSelector(
    'getGroupListPermissions',
    getMyGroupRoles,
    getRoles,
    getMySystemPermissions,
    (state) => state.entities.groups.groups,
    (myGroupRoles, roles, systemPermissions, allGroups) => {
        const groups = Object.entries(allGroups).filter((entry) => (entry[1].allow_reference)).map((entry) => entry[1]);

        const permissions = new Set<string>();
        groups.forEach((group) => {
            const roleNames = myGroupRoles[group.id!];
            if (roleNames) {
                for (const roleName of roleNames) {
                    if (roles[roleName]) {
                        for (const permission of roles[roleName].permissions) {
                            permissions.add(permission);
                        }
                    }
                }
            }
        });

        for (const permission of systemPermissions) {
            permissions.add(permission);
        }

        const groupPermissionsMap: Record<string, GroupPermissions> = {};
        groups.forEach((g) => {
            groupPermissionsMap[g.id] = {
                can_delete: permissions.has(Permissions.DELETE_CUSTOM_GROUP) && g.source.toLowerCase() !== 'ldap' && g.delete_at === 0,
                can_manage_members: permissions.has(Permissions.MANAGE_CUSTOM_GROUP_MEMBERS) && g.source.toLowerCase() !== 'ldap' && g.delete_at === 0,
                can_restore: permissions.has(Permissions.RESTORE_CUSTOM_GROUP) && g.source.toLowerCase() !== 'ldap' && g.delete_at !== 0,
            };
        });
        return groupPermissionsMap;
    },
);

export const getMyTeamRoles: (state: GlobalState) => Record<string, Set<string>> = createSelector(
    'getMyTeamRoles',
    getTeamMemberships,
    (teamsMemberships) => {
        const roles: Record<string, Set<string>> = {};
        if (teamsMemberships) {
            for (const key in teamsMemberships) {
                if (teamsMemberships.hasOwnProperty(key) && teamsMemberships[key].roles) {
                    roles[key] = new Set<string>(teamsMemberships[key].roles.split(' '));
                }
            }
        }
        return roles;
    },
);

export function getMyChannelRoles(state: GlobalState): Record<string, Set<string>> {
    return state.entities.channels.roles;
}

export const getRolesById: (state: GlobalState) => Record<string, Role> = createSelector(
    'getRolesById',
    getRoles,
    (rolesByName) => {
        const rolesById: Record<string, Role> = {};
        for (const role of Object.values(rolesByName)) {
            rolesById[role.id] = role;
        }
        return rolesById;
    },
);

const getMyPermissionsByTeam = createSelector(
    'getMyPermissionsByTeam',
    getMyTeamRoles,
    getRoles,
    (myTeamRoles, allRoles) => {
        const permissionsByTeam: Record<string, Set<string>> = {};

        for (const [teamId, roles] of Object.entries(myTeamRoles)) {
            permissionsByTeam[teamId] = getPermissionsForRoles(allRoles, roles);
        }

        return permissionsByTeam;
    },
);

const getMyPermissionsByGroup = createSelector(
    'getMyPermissionsByGroup',
    getMyGroupRoles,
    getRoles,
    (myGroupRoles, allRoles) => {
        const permissionsByGroup: Record<string, Set<string>> = {};

        for (const [groupId, roles] of Object.entries(myGroupRoles)) {
            permissionsByGroup[groupId] = getPermissionsForRoles(allRoles, roles);
        }

        return permissionsByGroup;
    },
);

const getMyPermissionsByChannel = createSelector(
    'getMyPermissionsByChannel',
    getMyChannelRoles,
    getRoles,
    (myChannelRoles, allRoles) => {
        const permissionsByChannel: Record<string, Set<string>> = {};

        for (const [channelId, roles] of Object.entries(myChannelRoles)) {
            permissionsByChannel[channelId] = getPermissionsForRoles(allRoles, roles);
        }

        return permissionsByChannel;
    },
);

export function haveITeamPermission(state: GlobalState, teamId: string, permission: string) {
    return (
        getMySystemPermissions(state).has(permission) ||
        getMyPermissionsByTeam(state)[teamId]?.has(permission)
    );
}

export const haveIGroupPermission: (state: GlobalState, groupID: string, permission: string) => boolean = createSelector(
    'haveIGroupPermission',
    getMySystemPermissions,
    getMyPermissionsByGroup,
    (state: GlobalState, groupID: string) => state.entities.groups.groups[groupID],
    (state: GlobalState, groupID: string, permission: string) => permission,
    (systemPermissions, permissionGroups, group, permission) => {
        if (permission === Permissions.RESTORE_CUSTOM_GROUP) {
            if ((group.source !== 'ldap' && group.delete_at !== 0) && (systemPermissions.has(permission) || (permissionGroups[group.id] && permissionGroups[group.id].has(permission)))) {
                return true;
            }
            return false;
        }

        if (group.source === 'ldap' || group.delete_at !== 0) {
            return false;
        }

        if (systemPermissions.has(permission)) {
            return true;
        }

        if (permissionGroups[group.id] && permissionGroups[group.id].has(permission)) {
            return true;
        }
        return false;
    },
);

export function haveIChannelPermission(state: GlobalState, teamId: string, channelId: string, permission: string): boolean {
    return (
        getMySystemPermissions(state).has(permission) ||
        getMyPermissionsByTeam(state)[teamId]?.has(permission) ||
        getMyPermissionsByChannel(state)[channelId]?.has(permission)
    );
}

export function haveICurrentTeamPermission(state: GlobalState, permission: string): boolean {
    return haveITeamPermission(state, getCurrentTeamId(state), permission);
}

export function haveICurrentChannelPermission(state: GlobalState, permission: string): boolean {
    return haveIChannelPermission(state, getCurrentTeamId(state), getCurrentChannelId(state), permission);
}
