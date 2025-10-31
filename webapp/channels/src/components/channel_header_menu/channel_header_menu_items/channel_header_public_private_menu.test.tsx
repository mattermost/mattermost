// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import * as officialChannelUtils from 'utils/official_channel_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderPublicMenu from './channel_header_public_private_menu';

describe('components/ChannelHeaderMenu/ChannelHeaderPublicPrivateMenu', () => {
    const defaultProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'channel_name',
            type: 'O' as const,
        }),
        user: TestHelper.getUserMock({
            id: 'user_id',
            roles: 'user',
        }),
        isMuted: false,
        isReadonly: false,
        isDefault: false,
        isMobile: false,
        isFavorite: false,
        isLicensedForLDAPGroups: false,
        pluginItems: [],
        isChannelBookmarksEnabled: false,
        leadingElement: <div/>,
        onItemActivated: jest.fn(),
        isMenuOpen: false,
        menuId: 'test-menu',
        menuButtonId: 'test-menu-button',
        menuAriaLabel: 'test menu',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render Leave Channel and Archive Channel for regular channels', () => {
        // Temporarily suppress console warnings for this test
        const originalError = console.error;
        console.error = jest.fn();

        const regularChannel = TestHelper.getChannelMock({
            id: 'regular_channel_id',
            name: 'regular-channel',
            type: 'O',
            creator_id: 'regular_user',
        });

        const props = {
            ...defaultProps,
            channel: regularChannel,
        };

        try {
            renderWithContext(<ChannelHeaderPublicMenu {...props}/>, {
                entities: {
                    users: {
                        currentUserId: 'user_id',
                        profiles: {
                            user_id: {
                                id: 'user_id',
                                roles: 'user',
                            },
                        },
                    },
                    teams: {
                        currentTeamId: 'team_id',
                        teams: {
                            team_id: {
                                id: 'team_id',
                                name: 'test-team',
                            },
                        },
                    },
                    channels: {
                        channels: {
                            regular_channel_id: {
                                ...regularChannel,
                                team_id: 'team_id',
                            },
                        },
                        membersInChannel: {
                            regular_channel_id: {
                                user_id: {
                                    user_id: 'user_id',
                                    channel_id: 'regular_channel_id',
                                    roles: 'channel_user',
                                },
                            },
                        },
                    },
                    roles: {
                        roles: {
                            user: {
                                permissions: [
                                    'delete_public_channel',
                                    'manage_public_channel_members',
                                    'read_channel',
                                    'add_reaction',
                                    'remove_reaction',
                                    'leave_channel',
                                ],
                            },
                            channel_user: {
                                permissions: [
                                    'read_channel',
                                    'leave_channel',
                                ],
                            },
                        },
                    },
                },
            });

            expect(screen.getByText('Leave Channel')).toBeInTheDocument();
            expect(screen.getByText('Archive Channel')).toBeInTheDocument();
        } finally {
            // Restore original console.error
            console.error = originalError;
        }
    });

    test('should not render Leave Channel and Archive Channel for official TUNAG channels', () => {
        // Mock the official channel detection function to return true
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(true);

        const officialChannel = TestHelper.getChannelMock({
            id: 'tunag_channel_id',
            name: 'tunag-12345-subdomain-admin',
            type: 'O' as const,
        });

        const props = {
            ...defaultProps,
            channel: officialChannel,
        };

        renderWithContext(<ChannelHeaderPublicMenu {...props}/>, {});

        expect(screen.queryByText('Leave Channel')).not.toBeInTheDocument();
        expect(screen.queryByText('Archive Channel')).not.toBeInTheDocument();
    });

    test('should not render Leave Channel and Archive Channel for default channels', () => {
        // Mock the official channel detection function to return false
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(false);

        const defaultChannel = TestHelper.getChannelMock({
            id: 'default_channel_id',
            name: 'town-square',
            type: 'O' as const,
        });

        const props = {
            ...defaultProps,
            channel: defaultChannel,
            isDefault: true,
        };

        renderWithContext(<ChannelHeaderPublicMenu {...props}/>, {});

        // Default channels should not show these options regardless of official status
        expect(screen.queryByText('Leave Channel')).not.toBeInTheDocument();
        expect(screen.queryByText('Archive Channel')).not.toBeInTheDocument();
    });

    test('should not render Leave Channel for guest users', () => {
        // Mock the official channel detection function to return false
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(false);

        const regularChannel = TestHelper.getChannelMock({
            id: 'regular_channel_id',
            name: 'regular-channel',
            type: 'O' as const,
        });

        const guestUser = TestHelper.getUserMock({
            id: 'guest_user_id',
            roles: 'system_guest',
        });

        const props = {
            ...defaultProps,
            channel: regularChannel,
            user: guestUser,
        };

        renderWithContext(<ChannelHeaderPublicMenu {...props}/>, {
            entities: {
                users: {
                    currentUserId: 'guest_user_id',
                    profiles: {
                        guest_user_id: {
                            id: 'guest_user_id',
                            roles: 'system_guest',
                        },
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: {
                            id: 'team_id',
                            name: 'test-team',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_guest: {
                            permissions: [
                                'delete_public_channel',
                                'manage_public_channel_members',
                            ],
                        },
                    },
                },
            },
        });

        // Guest users should not see Leave Channel
        expect(screen.queryByText('Leave Channel')).not.toBeInTheDocument();

        // But Archive Channel should still be visible (if user has permissions)
        expect(screen.getByText('Archive Channel')).toBeInTheDocument();
    });
});
