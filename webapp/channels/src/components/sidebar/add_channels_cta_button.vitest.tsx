// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UsersState} from '@mattermost/types/users';

import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';

import AddChannelsCtaButton from './add_channels_cta_button';

const mockDispatch = vi.fn();
let mockState: GlobalState;

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual as object,
        useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
        useDispatch: () => mockDispatch,
    };
});

describe('components/new_channel_modal', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockState = {
            entities: {
                general: {
                    config: {},
                },
                channels: {
                    currentChannelId: 'current_channel_id',
                    channels: {},
                    roles: {
                        current_channel_id: [
                            'channel_user',
                            'channel_admin',
                        ],
                    },
                },
                teams: {
                    currentTeamId: 'current_team_id',
                    myMembers: {
                        current_team_id: {
                            roles: 'team_user team_admin',
                        },
                    },
                    teams: {
                        current_team_id: {
                            id: 'current_team_id',
                            description: 'Curent team description',
                            name: 'current-team',
                        },
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
                roles: {
                    roles: {
                        guest_user: {
                            permissions: [],
                        },
                        system_user: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS, Permissions.CREATE_PRIVATE_CHANNEL, Permissions.CREATE_PUBLIC_CHANNEL],
                        },
                        system_user_join_permissions: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS],
                        },
                        system_user_create_public_permissions: {
                            permissions: [Permissions.JOIN_PUBLIC_CHANNELS, Permissions.CREATE_PUBLIC_CHANNEL],
                        },
                    },
                },
            },
            views: {
                addChannelCtaDropdown: {
                    isOpen: false,
                },
            },
        } as unknown as GlobalState;
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when user has only join channel permissions', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_join_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should find the add channels button when user has permissions', () => {
        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );
        expect(container.querySelector('.AddChannelsCtaDropdown')).toBeTruthy();
    });

    test('should return nothing when user does not have permissions', () => {
        const guestUser = {
            currentUserId: 'guest_user_id',
            profiles: {
                user_id: {
                    id: 'guest_user_id',
                    roles: 'team_role',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: guestUser}};

        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );
        expect(container.querySelector('.AddChannelsCtaDropdown')).toBeFalsy();
    });

    test('should fire dispatch to save preferences when button is clicked', () => {
        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );
        const button = container.querySelector('.AddChannelsCtaDropdown button');
        expect(mockDispatch).not.toHaveBeenCalled();
        if (button) {
            fireEvent.click(button);
        }
        expect(mockDispatch).toHaveBeenCalled();
    });

    test('should not display as a Cta Dropdown when user only has permissions to join channels ', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_join_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );

        // do not find the menu
        expect(container.querySelector('.AddChannelsCtaDropdown')).toBeFalsy();

        // only find the button
        const button = container.querySelector('button#addChannelsCta');
        expect(button).toBeTruthy();

        if (button) {
            fireEvent.click(button);
        }

        // when clicked show the browse channels modal
    });

    test('should still display as a Cta Dropdown when user has permissions to create at least one form of channel', () => {
        const userWithJoinChannelsPermission = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'system_user_create_public_permissions',
                },
            },
        } as unknown as UsersState;
        mockState = {...mockState, entities: {...mockState.entities, users: userWithJoinChannelsPermission}};

        const {container} = renderWithContext(
            <AddChannelsCtaButton/>,
        );

        expect(container.querySelector('.AddChannelsCtaDropdown')).toBeTruthy();
    });
});
