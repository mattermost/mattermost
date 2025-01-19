// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

import SidebarHeader from './sidebar_header';
import type {Props} from './sidebar_header';

describe('SidebarHeader', () => {
    const defaultProps: Props = {
        showNewChannelModal: jest.fn(),
        showMoreChannelsModal: jest.fn(),
        invitePeopleModal: jest.fn(),
        showCreateCategoryModal: jest.fn(),
        canCreateChannel: true,
        canJoinPublicChannel: true,
        handleOpenDirectMessagesModal: jest.fn(),
        unreadFilterEnabled: true,
        showCreateUserGroupModal: jest.fn(),
        userGroupsEnabled: false,
        canCreateCustomGroups: true,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            teams: {
                currentTeamId: 'currentteam',
                teams: {
                    currentteam: {
                        id: 'currentteam',
                        display_name: 'Steadfast',
                        description: 'et iste illum reprehenderit aliquid in rem itaque in maxime eius.',
                    },
                },
            },
            users: {
                profiles: {
                    uid: {
                        id: 'uid',
                        roles: 'system_user system_admin',
                    },
                },
                currentUserId: 'uid',
            },
            usage: {
                integrations: {
                    enabled: 11,
                    enabledLoaded: true,
                },
                messages: {
                    history: 10000,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: FileSizes.Gigabyte,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 1,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 500,
                    cardsLoaded: true,
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                },
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 10,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
                    },
                },
            },
        },
        views: {
            addChannelDropdown: {
                isOpen: false,
            },
        },
    };

    test('should render the team name and menu button', () => {
        renderWithContext(<SidebarHeader {...defaultProps}/>, initialState);

        expect(screen.getByText('Steadfast')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Steadfast/i})).toBeInTheDocument();
    });

    test('should render the add channel dropdown', () => {
        renderWithContext(<SidebarHeader {...defaultProps}/>, initialState);

        expect(screen.getByRole('button', {name: /Add Channel Dropdown/i})).toBeInTheDocument();
    });

    test('should don\'t render anything when team is empty', () => {
        const state = {...initialState};
        state.entities.teams.currentTeamId = '';
        renderWithContext(<SidebarHeader {...defaultProps}/>, state);

        expect(screen.queryByRole('button', {name: /Steadfast/i})).toBeNull();
        expect(screen.queryByRole('button', {name: /Add Channel Dropdown/i})).toBeNull();
    });
});
