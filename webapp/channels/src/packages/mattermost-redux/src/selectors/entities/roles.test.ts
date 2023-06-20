// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TeamMembership} from '@mattermost/types/teams';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {Group} from '@mattermost/types/groups';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';
import TestHelper from '../../../test/test_helper';
import * as Selectors from 'mattermost-redux/selectors/entities/roles';
import {General, Permissions} from 'mattermost-redux/constants';
import {getMySystemPermissions, getMySystemRoles, getRoles} from 'mattermost-redux/selectors/entities/roles_helpers';

describe('Selectors.Roles', () => {
    const team1 = TestHelper.fakeTeamWithId();
    const team2 = TestHelper.fakeTeamWithId();
    const team3 = TestHelper.fakeTeamWithId();
    const myTeamMembers: Record<string, TeamMembership> = {};
    myTeamMembers[team1.id] = {roles: 'test_team1_role1 test_team1_role2'} as TeamMembership;
    myTeamMembers[team2.id] = {roles: 'test_team2_role1 test_team2_role2'} as TeamMembership;
    myTeamMembers[team3.id] = {} as TeamMembership;

    const channel1 = TestHelper.fakeChannelWithId(team1.id);
    channel1.display_name = 'Channel Name';

    const channel2 = TestHelper.fakeChannelWithId(team1.id);
    channel2.display_name = 'DEF';

    const channel3 = TestHelper.fakeChannelWithId(team2.id);

    const channel4 = TestHelper.fakeChannelWithId('');
    channel4.display_name = 'Channel 4';

    const channel5 = TestHelper.fakeChannelWithId(team1.id);
    channel5.type = General.PRIVATE_CHANNEL;
    channel5.display_name = 'Channel 5';

    const channel6 = TestHelper.fakeChannelWithId(team1.id);
    const channel7 = TestHelper.fakeChannelWithId('');
    channel7.display_name = '';
    channel7.type = General.GM_CHANNEL;

    const channel8 = TestHelper.fakeChannelWithId(team1.id);
    channel8.display_name = 'ABC';

    const channel9 = TestHelper.fakeChannelWithId(team1.id);
    const channel10 = TestHelper.fakeChannelWithId(team1.id);
    const channel11 = TestHelper.fakeChannelWithId(team1.id);
    channel11.type = General.PRIVATE_CHANNEL;
    const channel12 = TestHelper.fakeChannelWithId(team1.id);

    const channels: Record<string, Channel> = {};
    channels[channel1.id] = channel1;
    channels[channel2.id] = channel2;
    channels[channel3.id] = channel3;
    channels[channel4.id] = channel4;
    channels[channel5.id] = channel5;
    channels[channel6.id] = channel6;
    channels[channel7.id] = channel7;
    channels[channel8.id] = channel8;
    channels[channel9.id] = channel9;
    channels[channel10.id] = channel10;
    channels[channel11.id] = channel11;
    channels[channel12.id] = channel12;

    const channelsInTeam: Record<string, Array<Channel['id']>> = {};
    channelsInTeam[team1.id] = [channel1.id, channel2.id, channel5.id, channel6.id, channel8.id, channel10.id, channel11.id];
    channelsInTeam[team2.id] = [channel3.id];
    channelsInTeam[''] = [channel4.id, channel7.id, channel9.id];

    const user = TestHelper.fakeUserWithId();
    const profiles: Record<string, UserProfile> = {};
    profiles[user.id] = user;
    profiles[user.id].roles = 'test_user_role test_user_role2';

    const channelsRoles: Record<string, Set<string>> = {};
    channelsRoles[channel1.id] = new Set(['test_channel_a_role1', 'test_channel_a_role2']);
    channelsRoles[channel2.id] = new Set(['test_channel_a_role1', 'test_channel_a_role2']);
    channelsRoles[channel3.id] = new Set(['test_channel_a_role1', 'test_channel_a_role2']);
    channelsRoles[channel4.id] = new Set(['test_channel_a_role1', 'test_channel_a_role2']);
    channelsRoles[channel5.id] = new Set(['test_channel_a_role1', 'test_channel_a_role2']);
    channelsRoles[channel7.id] = new Set(['test_channel_b_role1', 'test_channel_b_role2']);
    channelsRoles[channel8.id] = new Set(['test_channel_b_role1', 'test_channel_b_role2']);
    channelsRoles[channel9.id] = new Set(['test_channel_b_role1', 'test_channel_b_role2']);
    channelsRoles[channel10.id] = new Set(['test_channel_c_role1', 'test_channel_c_role2']);
    channelsRoles[channel11.id] = new Set(['test_channel_c_role1', 'test_channel_c_role2']);
    const roles = {
        test_team1_role1: {permissions: ['team1_role1']},
        test_team2_role1: {permissions: ['team2_role1']},
        test_team2_role2: {permissions: ['team2_role2']},
        test_channel_a_role1: {permissions: ['channel_a_role1']},
        test_channel_a_role2: {permissions: ['channel_a_role2']},
        test_channel_b_role2: {permissions: ['channel_b_role2']},
        test_channel_c_role1: {permissions: ['channel_c_role1']},
        test_channel_c_role2: {permissions: ['channel_c_role2']},
        test_user_role2: {permissions: ['user_role2', Permissions.EDIT_CUSTOM_GROUP, Permissions.CREATE_CUSTOM_GROUP, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS, Permissions.DELETE_CUSTOM_GROUP]},
        custom_group_user: {permissions: ['custom_group_user']},
    };

    const group1 = TestHelper.fakeGroup('group1', 'custom');
    const group2 = TestHelper.fakeGroup('group2', 'custom');
    const group3 = TestHelper.fakeGroup('group3', 'custom');
    const group4 = TestHelper.fakeGroup('group4', 'custom');
    const group5 = TestHelper.fakeGroup('group5');

    const groups: Record<string, Group> = {};
    groups.group1 = group1;
    groups.group2 = group2;
    groups.group3 = group3;
    groups.group4 = group4;
    groups.group5 = group5;

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            users: {
                currentUserId: user.id,
                profiles,
            },
            teams: {
                currentTeamId: team1.id,
                myMembers: myTeamMembers,
            },
            channels: {
                currentChannelId: channel1.id,
                channels,
                roles: channelsRoles,
            },
            groups: {
                groups,
                myGroups: ['group1'],
            },
            roles: {
                roles,
            },
        },
    });

    it('should return my roles by scope on getMySystemRoles/getMyTeamRoles/getMyChannelRoles/getMyGroupRoles', () => {
        const teamsRoles: Record<string, Set<string>> = {};
        teamsRoles[team1.id] = new Set(['test_team1_role1', 'test_team1_role2']);
        teamsRoles[team2.id] = new Set(['test_team2_role1', 'test_team2_role2']);

        const groupRoles: Record<string, Set<string>> = {};
        groupRoles[group1.id] = new Set(['custom_group_user']);

        const myRoles = {
            system: new Set(['test_user_role', 'test_user_role2']),
            team: teamsRoles,
            channel: channelsRoles,
        };
        expect(getMySystemRoles(testState)).toEqual(myRoles.system);
        expect(Selectors.getMyTeamRoles(testState)).toEqual(myRoles.team);
        expect(Selectors.getMyChannelRoles(testState)).toEqual(myRoles.channel);
        expect(Selectors.getMyGroupRoles(testState)).toEqual(groupRoles);
    });

    it('should return current loaded roles on getRoles', () => {
        const loadedRoles = {
            test_team1_role1: {permissions: ['team1_role1']},
            test_team2_role1: {permissions: ['team2_role1']},
            test_team2_role2: {permissions: ['team2_role2']},
            test_channel_a_role1: {permissions: ['channel_a_role1']},
            test_channel_a_role2: {permissions: ['channel_a_role2']},
            test_channel_b_role2: {permissions: ['channel_b_role2']},
            test_channel_c_role1: {permissions: ['channel_c_role1']},
            test_channel_c_role2: {permissions: ['channel_c_role2']},
            test_user_role2: {permissions: ['user_role2', Permissions.EDIT_CUSTOM_GROUP, Permissions.CREATE_CUSTOM_GROUP, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS, Permissions.DELETE_CUSTOM_GROUP]},
            custom_group_user: {permissions: ['custom_group_user']},
        };
        expect(getRoles(testState)).toEqual(loadedRoles);
    });

    it('should return my system permission on getMySystemPermissions', () => {
        expect(getMySystemPermissions(testState)).toEqual(new Set([
            'user_role2', Permissions.EDIT_CUSTOM_GROUP, Permissions.CREATE_CUSTOM_GROUP, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS, Permissions.DELETE_CUSTOM_GROUP,
        ]));
    });

    it('should return if i have a system permission on haveISystemPermission', () => {
        expect(Selectors.haveISystemPermission(testState, {permission: 'user_role2'})).toEqual(true);
        expect(Selectors.haveISystemPermission(testState, {permission: 'invalid_permission'})).toEqual(false);
    });

    it('should return if i have a team permission on haveITeamPermission', () => {
        expect(Selectors.haveITeamPermission(testState, team1.id, 'user_role2')).toEqual(true);
        expect(Selectors.haveITeamPermission(testState, team1.id, 'team1_role1')).toEqual(true);
        expect(Selectors.haveITeamPermission(testState, team1.id, 'team2_role2')).toEqual(false);
        expect(Selectors.haveITeamPermission(testState, team1.id, 'invalid_permission')).toEqual(false);
    });

    it('should return if i have a team permission on haveICurrentTeamPermission', () => {
        expect(Selectors.haveICurrentTeamPermission(testState, 'user_role2')).toEqual(true);
        expect(Selectors.haveICurrentTeamPermission(testState, 'team1_role1')).toEqual(true);
        expect(Selectors.haveICurrentTeamPermission(testState, 'team2_role2')).toEqual(false);
        expect(Selectors.haveICurrentTeamPermission(testState, 'invalid_permission')).toEqual(false);
    });

    it('should return if i have a channel permission on haveIChannelPermission', () => {
        expect(Selectors.haveIChannelPermission(testState, team1.id, channel1.id, 'user_role2')).toEqual(true);
        expect(Selectors.haveIChannelPermission(testState, team1.id, channel1.id, 'team1_role1')).toEqual(true);
        expect(Selectors.haveIChannelPermission(testState, team1.id, channel1.id, 'team2_role2')).toEqual(false);
        expect(Selectors.haveIChannelPermission(testState, team1.id, channel1.id, 'channel_a_role1')).toEqual(true);
        expect(Selectors.haveIChannelPermission(testState, team1.id, channel1.id, 'channel_b_role1')).toEqual(false);
    });

    it('should return if i have a channel permission on haveICurrentChannelPermission', () => {
        expect(Selectors.haveICurrentChannelPermission(testState, 'user_role2')).toEqual(true);
        expect(Selectors.haveICurrentChannelPermission(testState, 'team1_role1')).toEqual(true);
        expect(Selectors.haveICurrentChannelPermission(testState, 'team2_role2')).toEqual(false);
        expect(Selectors.haveICurrentChannelPermission(testState, 'channel_a_role1')).toEqual(true);
        expect(Selectors.haveICurrentChannelPermission(testState, 'channel_b_role1')).toEqual(false);
    });

    it('should return group memberships on getGroupMemberships', () => {
        expect(Selectors.getGroupMemberships(testState)).toEqual({[group1.id]: {user_id: user.id, roles: 'custom_group_user'}});
    });

    it('should return if i have a group permission on haveIGroupPermission', () => {
        expect(Selectors.haveIGroupPermission(testState, group1.id, Permissions.EDIT_CUSTOM_GROUP)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group1.id, Permissions.CREATE_CUSTOM_GROUP)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group1.id, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group1.id, Permissions.DELETE_CUSTOM_GROUP)).toEqual(true);

        // You don't have to be a member to perform these actions
        expect(Selectors.haveIGroupPermission(testState, group2.id, Permissions.EDIT_CUSTOM_GROUP)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group2.id, Permissions.CREATE_CUSTOM_GROUP)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group2.id, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS)).toEqual(true);
        expect(Selectors.haveIGroupPermission(testState, group2.id, Permissions.DELETE_CUSTOM_GROUP)).toEqual(true);
    });

    it('should return false if i dont have a group permission on haveIGroupPermission', () => {
        const roles = {
            test_team1_role1: {permissions: ['team1_role1']},
            test_team2_role1: {permissions: ['team2_role1']},
            test_team2_role2: {permissions: ['team2_role2']},
            test_channel_a_role1: {permissions: ['channel_a_role1']},
            test_channel_a_role2: {permissions: ['channel_a_role2']},
            test_channel_b_role2: {permissions: ['channel_b_role2']},
            test_channel_c_role1: {permissions: ['channel_c_role1']},
            test_channel_c_role2: {permissions: ['channel_c_role2']},
            test_user_role2: {permissions: ['user_role2', Permissions.CREATE_CUSTOM_GROUP, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS, Permissions.DELETE_CUSTOM_GROUP]},
            custom_group_user: {permissions: ['custom_group_user']},
        };
        const newState = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: user.id,
                    profiles,
                },
                teams: {
                    currentTeamId: team1.id,
                    myMembers: myTeamMembers,
                },
                channels: {
                    currentChannelId: channel1.id,
                    channels,
                    roles: channelsRoles,
                },
                groups: {
                    groups,
                    myGroups: ['group1'],
                },
                roles: {
                    roles,
                },
            },
        });

        expect(Selectors.haveIGroupPermission(newState, group2.id, Permissions.EDIT_CUSTOM_GROUP)).toEqual(false);
        expect(Selectors.haveIGroupPermission(newState, group2.id, Permissions.CREATE_CUSTOM_GROUP)).toEqual(true);
        expect(Selectors.haveIGroupPermission(newState, group2.id, Permissions.MANAGE_CUSTOM_GROUP_MEMBERS)).toEqual(true);
        expect(Selectors.haveIGroupPermission(newState, group2.id, Permissions.DELETE_CUSTOM_GROUP)).toEqual(true);
    });

    it('should return group set with permissions on getGroupListPermissions', () => {
        expect(Selectors.getGroupListPermissions(testState)).toEqual({
            [group1.id]: {can_delete: true, can_manage_members: true},
            [group2.id]: {can_delete: true, can_manage_members: true},
            [group3.id]: {can_delete: true, can_manage_members: true},
            [group4.id]: {can_delete: true, can_manage_members: true},
            [group5.id]: {can_delete: false, can_manage_members: false},
        });
    });
});
