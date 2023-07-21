// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import React from 'react';
import {Provider} from 'react-redux';

import {renderWithIntl, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import AboutAreaChannel from './about_area_channel';

const initialState = {
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
                    type: '0',
                    team_id: 'team_id',
                },
            },
            channelsInTeam: {
                'team-id': ['current_channel_id'],
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
                    displayName: 'Team 1',
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
            config: {PostEditTimeLimit: -1},
        },
    },
};

describe('channel_info_rhs/about_area_channel', () => {
    const defaultProps = {
        channel: {
            id: 'test-c-id',
            header: 'my channel header',
            purpose: 'my channel purpose',
        } as Channel,
        channelURL: 'https://my-url.mm',
        canEditChannelProperties: true,
        actions: {
            editChannelPurpose: jest.fn(),
            editChannelHeader: jest.fn(),
        },
    };

    test('should display channel purpose', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <AboutAreaChannel
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByText('my channel purpose')).toBeInTheDocument();
    });

    test('should display channel header', async () => {
        const store = await mockStore(initialState);
        renderWithIntl(
            <Provider store={store}>
                <AboutAreaChannel
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByText('my channel header')).toBeInTheDocument();
    });
});
