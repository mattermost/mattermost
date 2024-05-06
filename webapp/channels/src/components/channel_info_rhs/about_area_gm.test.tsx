// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import AboutAreaGM from './about_area_gm';

const initialState: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            myMembers: {
                current_channel_id: {
                    channel_id: 'current_channel_id',
                    user_id: 'current_user_id',
                    roles: 'channel_role',
                    mention_count: 1,
                    msg_count: 9,
                },
            },
            channels: {
                current_channel_id: {
                    id: 'current_channel_id',
                    name: 'default-name',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'O',
                    team_id: 'team_id',
                },
                current_user_id__existingId: {
                    id: 'current_user_id__existingId',
                    name: 'current_user_id__existingId',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'D',
                    team_id: 'team_id',
                },
            },
            channelsInTeam: {
                'team-id': new Set(['current_channel_id']),
            },
            messageCounts: {
                current_channel_id: {total: 10},
                current_user_id__existingId: {total: 0},
            },
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': {
                    id: 'team_id',
                    name: 'team-1',
                    display_name: 'Team 1',
                },
            },
            myMembers: {
                'team-id': {roles: 'team_role'},
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_role'},
                'test-u-id': {username: 'my username'},
                'test-u-id2': {username: 'my username 2'},
            },
        },
        groups: {
            groups: {},
            syncables: {},
            myGroups: [],
            stats: {},
        },
        emojis: {customEmoji: {}},
        preferences: {
            myPreferences: {
                'display_settings--name_format': {
                    category: 'display_settings',
                    name: 'name_format',
                    user_id: 'current_user_id',
                    value: 'username',
                },
            },
        },
        roles: {
            roles: {
                system_role: {
                    permissions: [],
                },
                team_role: {
                    permissions: [],
                },
                channel_role: {
                    permissions: [],
                },
            },
        },
        general: {
            license: {IsLicensed: 'false'},
            serverVersion: '5.4.0',
            config: {PostEditTimeLimit: '-1'},
        },
    },
    views: {
        browser: {
            windowSize: '',
        },
    },
};

describe('channel_info_rhs/about_area_gm', () => {
    const defaultProps = {
        channel: {
            id: 'test-c-id',
            header: 'my channel header',
        } as Channel,
        gmUsers: [
            {
                id: 'test-u-id',
                last_picture_update: 1234,
                username: 'my username',
            } as UserProfile,
            {
                id: 'test-u-id2',
                last_picture_update: 4321,
                username: 'my username2',
            } as UserProfile,
        ],
        actions: {
            editChannelHeader: jest.fn(),
        },
    };

    test('should display users avatar', () => {
        renderWithContext(
            <AboutAreaGM
                {...defaultProps}
            />,
            initialState,
        );

        expect(screen.getByAltText('my username profile image')).toBeInTheDocument();
        expect(screen.getByAltText('my username2 profile image')).toBeInTheDocument();
    });

    test('should display user names', () => {
        renderWithContext(
            <AboutAreaGM
                {...defaultProps}
            />,
            initialState,
        );

        expect(screen.getByLabelText('my username')).toBeInTheDocument();
    });

    test('should display channel header', () => {
        renderWithContext(
            <AboutAreaGM
                {...defaultProps}
            />,
            initialState,
        );

        expect(screen.getByText('my channel header')).toBeInTheDocument();
    });
});
