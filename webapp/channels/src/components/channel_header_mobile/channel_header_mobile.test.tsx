// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {screen} from '@testing-library/react';
import configureStore from 'redux-mock-store';

import {renderWithIntl} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderMobile from './channel_header_mobile';

const mockStore = configureStore();

const defaultState = {
    entities: {
        general: {
            config: {},
        },
        teams: {
            currentTeamId: 'team_id',
            teams: {
                team_id: {
                    id: 'team_id',
                    name: 'team',
                    display_name: 'Team',
                },
            },
        },
        channels: {
            channels: {},
            myMembers: {},
        },
        users: {
            currentUserId: 'user_id',
            profiles: {
                user_id: {
                    id: 'user_id',
                    username: 'username',
                    roles: '',
                },
            },
        },
        preferences: {
            myPreferences: {},
        },
        groups: {
            groups: {},
            myGroups: [],
        },
        emojis: {
            customEmoji: {},
        },
        apps: {
            main: {
                bindings: [],
            },
        },
        threads: {
            countsIncludingDirect: {},
        },
    },
    plugins: {
        components: {
            MobileChannelHeaderButton: [],
        },
    },
};

describe('components/ChannelHeaderMobile/ChannelHeaderMobile', () => {
    global.document.querySelector = jest.fn().mockReturnValue({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    });

    const baseProps = {
        user: TestHelper.getUserMock({
            id: 'user_id',
        }),
        channel: TestHelper.getChannelMock({
            type: 'O',
            id: 'channel_id',
            display_name: 'display_name',
            team_id: 'team_id',
        }),
        member: TestHelper.getChannelMembershipMock({
            channel_id: 'channel_id',
            user_id: 'user_id',
        }),
        teamDisplayName: 'team_display_name',
        isPinnedPosts: true,
        actions: {
            closeLhs: jest.fn(),
            closeRhs: jest.fn(),
            closeRhsMenu: jest.fn(),
        },
        isLicensed: true,
        isMobileView: false,
        isFavoriteChannel: false,
    };

    test('should render channel header mobile component', () => {
        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        channel_id: baseProps.channel,
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        user_id: baseProps.user,
                    },
                },
            },
        });

        renderWithIntl(
            <Provider store={store}>
                <ChannelHeaderMobile {...baseProps}/>
            </Provider>,
        );

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Toggle sidebar Menu Icon'})).toBeInTheDocument();
    });

    test('should render default channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'O',
                id: '123',
                name: 'town-square',
                display_name: 'Town Square',
                team_id: 'team_id',
            }),
        };

        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        123: props.channel,
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        user_id: props.user,
                    },
                },
            },
        });

        renderWithIntl(
            <Provider store={store}>
                <ChannelHeaderMobile {...props}/>
            </Provider>,
        );

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.innerHTML).toMatch(/Town Square/i);
    });

    test('should render DM channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'D',
                id: 'channel_id',
                name: 'user_id_1__user_id_2',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };

        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        channel_id: props.channel,
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        user_id: props.user,
                    },
                },
            },
        });

        renderWithIntl(
            <Provider store={store}>
                <ChannelHeaderMobile {...props}/>
            </Provider>,
        );

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.innerHTML).toMatch(/display_name/i);
    });

    test('should render private channel header', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                type: 'P',
                id: 'channel_id',
                display_name: 'display_name',
                team_id: 'team_id',
            }),
        };

        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        channel_id: props.channel,
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        user_id: props.user,
                    },
                },
            },
        });

        renderWithIntl(
            <Provider store={store}>
                <ChannelHeaderMobile {...props}/>
            </Provider>,
        );

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        const heading = screen.getByRole('navigation').querySelector('.navbar-brand');
        expect(heading).not.toBeNull();
        expect(heading).toBeInTheDocument();
        expect(heading?.innerHTML).toMatch(/display_name/i);
    });
});
