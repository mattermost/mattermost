// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import {Provider} from 'react-redux';

import {renderWithIntl} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import Constants from 'utils/constants';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import AboutAreaDM from './about_area_dm';

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

describe('channel_info_rhs/about_area_dm', () => {
    const defaultProps = {
        channel: {
            id: 'test-c-id',
            header: 'my channel header',
        } as Channel,
        dmUser: {
            user: {
                id: 'test-u-id',
                last_picture_update: 1234,
                is_bot: false,
                username: 'my_username',
                bot_description: 'my bot description',
                position: 'my position',
            } as UserProfile,
            display_name: 'my_username',
            is_guest: false,
            status: Constants.UserStatuses.ONLINE,
        },
        actions: {
            editChannelHeader: jest.fn(),
        },
    };

    test('should display user avatar', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByAltText('my_username profile image')).toBeInTheDocument();
    });

    test('should display user name', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByText('my_username')).toBeInTheDocument();
    });

    test('should display user position', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByText('my position')).toBeInTheDocument();
    });

    test('should display bot tag', async () => {
        const store = await mockStore(initialState);
        const props = {
            ...defaultProps,
            dmUser: {
                ...defaultProps.dmUser,
                user: {
                    ...defaultProps.dmUser.user,
                    is_bot: true,
                },
            },
        };
        const {container} = renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...props}
                />
            </Provider>,
        );
        expect(container.querySelector('.Tag')).toBeInTheDocument();
        expect(container.querySelector('.Tag')).toHaveTextContent('BOT');
    });

    test('should display guest tag', async () => {
        const store = await mockStore(initialState);
        const props = {
            ...defaultProps,
            dmUser: {
                ...defaultProps.dmUser,
                is_guest: true,
            },
        };
        const {container} = renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...props}
                />
            </Provider>,
        );
        expect(container.querySelector('.Tag')).toBeInTheDocument();
        expect(container.querySelector('.Tag')).toHaveTextContent('GUEST');
    });

    test('should display bot description', async () => {
        const store = await mockStore(initialState);
        const props = {
            ...defaultProps,
            dmUser: {
                ...defaultProps.dmUser,
                user: {
                    ...defaultProps.dmUser.user,
                    is_bot: true,
                },
            },
        };
        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...props}
                />
            </Provider>,
        );

        expect(screen.getByText('my bot description')).toBeInTheDocument();
    });

    test('should display channel header', async () => {
        const store = await mockStore(initialState);
        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...defaultProps}
                />
            </Provider>,
        );

        expect(screen.getByText('my channel header')).toBeInTheDocument();
    });

    test('should not display channel header for bots', async () => {
        const store = await mockStore(initialState);
        const props = {
            ...defaultProps,
            dmUser: {
                ...defaultProps.dmUser,
                user: {
                    ...defaultProps.dmUser.user,
                    is_bot: true,
                },
            },
        };
        renderWithIntl(
            <Provider store={store}>
                <AboutAreaDM
                    {...props}
                />
            </Provider>,
        );

        expect(screen.queryByText('my channel header')).not.toBeInTheDocument();
    });
});
