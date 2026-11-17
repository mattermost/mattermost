// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import Permissions from 'mattermost-redux/constants/permissions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import AddChannelsCtaButton from './add_channels_cta_button';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

const mockDispatch = jest.fn();
let mockRailKind: 'channel' | 'board' = 'channel';

jest.mock('hooks/useProductRailKind', () => ({
    useProductRailKind: () => mockRailKind,
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

describe('components/new_channel_modal', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {},
                roles: {
                    current_channel_id: new Set([
                        'channel_user',
                        'channel_admin',
                    ]),
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
                        description: 'Current team description',
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
            browser: {
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
        },
    };

    beforeEach(() => {
        mockDispatch.mockClear();
        (savePreferences as jest.Mock).mockClear();
        mockRailKind = 'channel';
    });

    describe('on the Boards item of the product rail', () => {
        const createBoardAction = jest.fn();
        const withBoardMenuItem = {
            ...initialState,
            plugins: {
                components: {
                    SidebarBrowseOrAddChannelMenu: [{
                        id: 'create_board',
                        pluginId: 'boards',
                        text: 'Create new board',
                        action: createBoardAction,
                        icon: <i className='icon-product-boards'/>,
                        placement: 'afterCreateChannel' as const,
                    }],
                },
            },
        };

        beforeEach(() => {
            mockRailKind = 'board';
            createBoardAction.mockClear();
        });

        test('should offer board creation from the plugin instead of channel creation', async () => {
            renderWithContext(<AddChannelsCtaButton/>, withBoardMenuItem);

            await userEvent.click(screen.getByRole('button', {name: /add boards/i}));

            expect(screen.queryByText('Create new channel')).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('menuitem', {name: /create new board/i}));

            // Menu items run their action once the menu has closed.
            await waitFor(() => expect(createBoardAction).toHaveBeenCalledWith('current_team_id'));
        });

        test('should keep the channel wording when no plugin offers board creation', () => {
            renderWithContext(<AddChannelsCtaButton/>, initialState);

            expect(screen.getByRole('button', {name: /add channels/i})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /add boards/i})).not.toBeInTheDocument();
        });
    });

    test('should find the add channels button when user has permissions', () => {
        renderWithContext(<AddChannelsCtaButton/>, initialState);

        const button = screen.getByRole('button', {name: /add channels/i});
        expect(button).toHaveAttribute('aria-haspopup', 'true');
    });

    test('should return nothing when user does not have permissions', () => {
        const guestState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: 'guest_user_id',
                    profiles: {
                        guest_user_id: {
                            id: 'guest_user_id',
                            roles: 'guest_user',
                        },
                    },
                },
            },
        };

        const {container} = renderWithContext(<AddChannelsCtaButton/>, guestState);

        expect(container.querySelector('.AddChannelsCtaDropdown')).not.toBeInTheDocument();
    });

    test('should fire dispatch to save preferences when button is clicked', async () => {
        renderWithContext(<AddChannelsCtaButton/>, initialState);

        const button = screen.getByRole('button', {name: /add channels/i});
        expect(savePreferences).not.toHaveBeenCalled();

        await userEvent.click(button);

        expect(savePreferences).toHaveBeenCalledWith(
            'current_user_id',
            [{
                category: 'touched',
                user_id: 'current_user_id',
                name: 'add_channels_cta',
                value: 'true',
            }],
        );
    });

    test('should not display as a Cta Dropdown when user only has permissions to join channels ', () => {
        const joinOnlyState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            id: 'current_user_id',
                            roles: 'system_user_join_permissions',
                        },
                    },
                },
            },
        };

        const {container} = renderWithContext(<AddChannelsCtaButton/>, joinOnlyState);

        expect(container.querySelector('.AddChannelsCtaDropdown')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /add channels/i})).toBeInTheDocument();
    });

    test('should still display as a Cta Dropdown when user has permissions to create at least one form of channel', () => {
        const createPublicState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            id: 'current_user_id',
                            roles: 'system_user_create_public_permissions',
                        },
                    },
                },
            },
        };

        renderWithContext(<AddChannelsCtaButton/>, createPublicState);

        const button = screen.getByRole('button', {name: /add channels/i});
        expect(button).toHaveAttribute('aria-haspopup', 'true');
    });
});
