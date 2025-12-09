// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Permissions} from 'mattermost-redux/constants';

import type {GlobalState} from 'types/store';

import {canAccessChannelSettings} from './channel_settings';

// Mock the roles module
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: jest.fn(() => false),
}));

describe('Selectors.Views.ChannelSettings', () => {
    const teamId = 'team1';
    const channelId = 'channel1';
    const defaultChannelId = 'default_channel';
    const privateChannelId = 'private_channel1';

    // Helper function to create a fresh state for each test
    const createBaseState = () => ({
        entities: {
            channels: {
                channels: {
                    [channelId]: {
                        id: channelId,
                        team_id: teamId,
                        name: 'test-channel',
                        type: 'O', // Constants.OPEN_CHANNEL
                    },
                    [defaultChannelId]: {
                        id: defaultChannelId,
                        team_id: teamId,
                        name: 'town-square', // Constants.DEFAULT_CHANNEL
                        type: 'O', // Constants.OPEN_CHANNEL
                    },
                    [privateChannelId]: {
                        id: privateChannelId,
                        team_id: teamId,
                        name: 'private-channel',
                        type: 'P', // Constants.PRIVATE_CHANNEL
                    },
                },
            },
            roles: {
                roles: {},
            },
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        roles: 'system_user',
                    },
                },
            },
            teams: {
                currentTeamId: teamId,
                teams: {
                    [teamId]: {
                        id: teamId,
                        name: 'test-team',
                    },
                },
            },
        },
    } as unknown as GlobalState);

    beforeEach(() => {
        // Reset the mock to default behavior (return false for all permissions)
        const roles = require('mattermost-redux/selectors/entities/roles');
        roles.haveIChannelPermission.mockReset();
        roles.haveIChannelPermission.mockReturnValue(false);
    });

    // Helper to set permission check results for specific tests
    const setPermissionCheckResults = (permissionResults: Record<string, boolean>) => {
        const roles = require('mattermost-redux/selectors/entities/roles');
        roles.haveIChannelPermission.mockImplementation(
            (_state: GlobalState, _teamId: string, _channelId: string, permission: string) => {
                return permissionResults[permission] || false;
            },
        );
    };

    it('should return false when channel does not exist', () => {
        const result = canAccessChannelSettings(createBaseState(), 'nonexistent_channel');
        expect(result).toBe(false);
    });

    it('should return true when user has info tab permission for public channel', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: true,
            [Permissions.MANAGE_PUBLIC_CHANNEL_BANNER]: false,
            [Permissions.DELETE_PUBLIC_CHANNEL]: false,
        });
        const result = canAccessChannelSettings(createBaseState(), channelId);
        expect(result).toBe(true);
    });

    it('should return true when user has info tab permission for private channel', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES]: true,
            [Permissions.MANAGE_PRIVATE_CHANNEL_BANNER]: false,
            [Permissions.DELETE_PRIVATE_CHANNEL]: false,
        });
        const result = canAccessChannelSettings(createBaseState(), privateChannelId);
        expect(result).toBe(true);
    });

    it('should return true when user has banner tab permission', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: false,
            [Permissions.MANAGE_PUBLIC_CHANNEL_BANNER]: true,
            [Permissions.DELETE_PUBLIC_CHANNEL]: false,
        });
        const result = canAccessChannelSettings(createBaseState(), channelId);
        expect(result).toBe(true);
    });

    it('should return true when user has archive tab permission', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: false,
            [Permissions.MANAGE_PUBLIC_CHANNEL_BANNER]: false,
            [Permissions.DELETE_PUBLIC_CHANNEL]: true,
        });
        const result = canAccessChannelSettings(createBaseState(), channelId);
        expect(result).toBe(true);
    });

    it('should return false when user has no permissions', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: false,
            [Permissions.MANAGE_PUBLIC_CHANNEL_BANNER]: false,
            [Permissions.DELETE_PUBLIC_CHANNEL]: false,
        });
        const result = canAccessChannelSettings(createBaseState(), channelId);
        expect(result).toBe(false);
    });

    it('should return false for default channel with only archive permission', () => {
        setPermissionCheckResults({
            [Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]: false,
            [Permissions.MANAGE_PUBLIC_CHANNEL_BANNER]: false,
            [Permissions.DELETE_PUBLIC_CHANNEL]: true, // This should be ignored for default channel
        });
        const result = canAccessChannelSettings(createBaseState(), defaultChannelId);
        expect(result).toBe(false);
    });
});
