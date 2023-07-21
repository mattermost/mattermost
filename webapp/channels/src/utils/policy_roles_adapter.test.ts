// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Role} from '@mattermost/types/roles';

import {Permissions} from 'mattermost-redux/constants/index';

import {rolesFromMapping, mappingValueFromRoles} from 'utils/policy_roles_adapter';

describe('PolicyRolesAdapter', () => {
    let roles: Record<string, any> = {};
    let policies: Record<string, any> = {};

    beforeEach(() => {
        roles = {
            channel_user: {
                name: 'channel_user',
                permissions: [
                    Permissions.EDIT_POST,
                    Permissions.DELETE_POST,
                    Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
                ],
            },
            team_user: {
                name: 'team_user',
                permissions: [
                    Permissions.INVITE_USER,
                    Permissions.ADD_USER_TO_TEAM,
                    Permissions.CREATE_PUBLIC_CHANNEL,
                    Permissions.CREATE_PRIVATE_CHANNEL,
                    Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
                    Permissions.DELETE_PUBLIC_CHANNEL,
                    Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
                    Permissions.DELETE_PRIVATE_CHANNEL,
                ],
            },
            channel_admin: {
                name: 'channel_admin',
                permissions: [
                    Permissions.MANAGE_CHANNEL_ROLES,
                ],
            },
            team_admin: {
                name: 'team_admin',
                permissions: [
                    Permissions.DELETE_POST,
                    Permissions.DELETE_OTHERS_POSTS,
                ],
            },
            system_admin: {
                name: 'system_admin',
                permissions: [
                    Permissions.DELETE_PUBLIC_CHANNEL,
                    Permissions.INVITE_USER,
                    Permissions.ADD_USER_TO_TEAM,
                    Permissions.DELETE_POST,
                    Permissions.DELETE_OTHERS_POSTS,
                    Permissions.EDIT_POST,
                ],
            },
            system_user: {
                name: 'system_user',
                permissions: [
                    Permissions.CREATE_TEAM,
                ],
            },
        };
        const teamPolicies = {
            restrictTeamInvite: 'all',
        };

        policies = {
            ...teamPolicies,
        };
    });

    afterEach(() => {
        roles = {};
    });

    describe('PolicyRolesAdapter.rolesFromMapping', () => {
        test('unknown value throws an exception', () => {
            policies.enableTeamCreation = 'sometimesmaybe';
            expect(() => {
                rolesFromMapping(policies, roles);
            }).toThrowError(/not present in mapping/i);
        });

        // // That way you can pass in the whole state if you want.
        test('ignores unknown keys', () => {
            policies.blah = 'all';
            expect(() => {
                rolesFromMapping(policies, roles);
            }).not.toThrowError();
        });

        test('mock data setup', () => {
            const updatedRoles = rolesFromMapping(policies, roles);
            expect(Object.values(updatedRoles).length).toEqual(0);
        });

        describe('enableTeamCreation', () => {
            test('true', () => {
                roles.system_user.permissions = [];
                const updatedRoles = rolesFromMapping({enableTeamCreation: 'true'}, roles);
                expect(Object.values(updatedRoles).length).toEqual(1);
                expect(updatedRoles.system_user.permissions).toEqual(expect.arrayContaining([Permissions.CREATE_TEAM]));
            });

            test('false', () => {
                roles.system_user.permissions = [Permissions.CREATE_TEAM];
                const updatedRoles = rolesFromMapping({enableTeamCreation: 'false'}, roles);
                expect(Object.values(updatedRoles).length).toEqual(1);
                expect(updatedRoles.system_user.permissions).not.toEqual(expect.arrayContaining([Permissions.CREATE_TEAM]));
            });
        });

        test('it only returns the updated roles', () => {
            const updatedRoles = rolesFromMapping(policies, roles);
            expect(Object.keys(updatedRoles).length).toEqual(0);
        });
    });

    describe('PolicyRolesAdapter.mappingValueFromRoles', () => {
        describe('enableTeamCreation', () => {
            test('returns the expected policy value for a enableTeamCreation policy', () => {
                addPermissionToRole(Permissions.CREATE_TEAM, roles.system_user);
                let value = mappingValueFromRoles('enableTeamCreation', roles);
                expect(value).toEqual('true');

                removePermissionFromRole(Permissions.CREATE_TEAM, roles.system_user);
                value = mappingValueFromRoles('enableTeamCreation', roles);
                expect(value).toEqual('false');
            });
        });
    });
});

function addPermissionToRole(permission: string, role: Role) {
    if (!role.permissions.includes(permission)) {
        role.permissions.push(permission);
    }
}

function removePermissionFromRole(permission: string, role: Role) {
    const permissionIndex = role.permissions.indexOf(permission);
    if (permissionIndex !== -1) {
        role.permissions.splice(permissionIndex, 1);
    }
}
