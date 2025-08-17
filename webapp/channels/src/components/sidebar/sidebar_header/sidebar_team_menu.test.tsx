// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SidebarTeamMenu from './sidebar_team_menu';

describe('components/sidebar/sidebar_header/sidebar_team_menu', () => {
    const currentTeam = TestHelper.getTeamMock({
        id: 'team-id',
        name: 'team-name',
        display_name: 'Team Name',
        description: 'Team Description',
    });

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    EnableGuestAccounts: 'true',
                },
                license: {
                    IsLicensed: 'true',
                    LDAPGroups: 'true',
                },
            },
            teams: {
                currentTeamId: currentTeam.id,
                teams: {
                    [currentTeam.id]: currentTeam,
                },
                myMembers: {
                    [currentTeam.id]: {
                        roles: 'team_user',
                    },
                },
            },
            users: {
                currentUserId: 'current-user-id',
                profiles: {
                    'current-user-id': {
                        id: 'current-user-id',
                        roles: 'system_user',
                    },
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [Permissions.CREATE_TEAM],
                    },
                    team_user: {
                        permissions: [
                            Permissions.ADD_USER_TO_TEAM,
                            Permissions.INVITE_GUEST,
                            Permissions.MANAGE_TEAM,
                            Permissions.REMOVE_USER_FROM_TEAM,
                            Permissions.MANAGE_TEAM_ROLES,
                        ],
                    },
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                },
                products: {},
            },
            usage: {
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                teams: {
                    active: 1,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
            },
        },
        plugins: {
            components: {
                MainMenu: [],
            },
        },
    };

    const baseProps = {
        currentTeam,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should open team menu when clicked', async () => {
        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            initialState,
        );

        const menuButton = screen.getByText(currentTeam.display_name);
        expect(menuButton).toBeInTheDocument();
        menuButton.click();

        await waitFor(() => {
            expect(screen.getByText('Team settings')).toBeInTheDocument();
            expect(screen.getByText('Manage members')).toBeInTheDocument();
            expect(screen.getByText('Leave team')).toBeInTheDocument();
            expect(screen.getByText('Create a team')).toBeInTheDocument();
            expect(screen.getByText('Learn about teams')).toBeInTheDocument();
        });
    });

    test('should show leave team option when primary team is not set', async () => {
        // State with no primary team set
        const state: DeepPartial<GlobalState> = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    config: {
                        ...initialState.entities?.general?.config,
                        ExperimentalPrimaryTeam: '',
                    },
                },
            },
        };

        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            state,
        );

        screen.getByText(currentTeam.display_name).click();

        await waitFor(() => {
            expect(screen.getByText('Leave team')).toBeInTheDocument();
        });
    });

    test('should hide leave team option when experimentalPrimaryTeam is same as current team', async () => {
        // State with current team set as primary team
        const state: DeepPartial<GlobalState> = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    config: {
                        ...initialState.entities?.general?.config,
                        ExperimentalPrimaryTeam: currentTeam.name,
                    },
                },
            },
        };

        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            state,
        );

        screen.getByText(currentTeam.display_name).click();

        await waitFor(() => {
            expect(screen.queryByText('Leave team')).not.toBeInTheDocument();
        });
    });

    test('should display plugin menu items when available', async () => {
        // State with plugin components
        const state: DeepPartial<GlobalState> = {
            ...initialState,
            plugins: {
                ...initialState.plugins,
                components: {
                    ...initialState.plugins?.components,
                    MainMenu: [
                        {
                            id: 'plugin-1',
                            pluginId: 'plugin-1',
                            text: 'Plugin Menu Item 1',
                            action: jest.fn(),
                            mobileIcon: <i className='icon-plugin-1'/>,
                        },
                        {
                            id: 'plugin-2',
                            pluginId: 'plugin-2',
                            text: 'Plugin Menu Item 2',
                            action: jest.fn(),
                            mobileIcon: <i className='icon-plugin-2'/>,
                        },
                    ],
                },
            },
        };

        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            state,
        );

        screen.getByText(currentTeam.display_name).click();

        await waitFor(() => {
            expect(screen.getByText('Plugin Menu Item 1')).toBeInTheDocument();
            expect(screen.getByText('Plugin Menu Item 2')).toBeInTheDocument();
        });
    });

    test('should hide "Invite people" option when user lacks permission to invite', async () => {
        const state: DeepPartial<GlobalState> = {
            ...initialState,
            entities: {
                ...initialState.entities,
                roles: {
                    ...initialState.entities?.roles,
                    roles: {
                        ...initialState.entities?.roles?.roles,
                        team_user: {
                            permissions: [
                                Permissions.ADD_USER_TO_TEAM,
                                Permissions.MANAGE_TEAM,
                                Permissions.REMOVE_USER_FROM_TEAM,
                                Permissions.MANAGE_TEAM_ROLES,
                            ],
                        },
                    },
                },
            },
        };

        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            state,
        );

        screen.getByText(currentTeam.display_name).click();

        await waitFor(() => {
            expect(screen.queryByText('Invite people')).not.toBeInTheDocument();
        });
    });

    test('should show restricted indicator for "Create a team" on cloud free plan', async () => {
        // State with cloud free plan
        const stateWithCloudFree: DeepPartial<GlobalState> = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    ...initialState.entities?.general,
                    license: {
                        ...initialState.entities?.general?.license,
                        Cloud: 'true',
                    },
                },
                cloud: {
                    ...initialState.entities?.cloud,
                    subscription: {
                        is_free_trial: 'true',
                    },
                },
            },
        };

        renderWithContext(
            <SidebarTeamMenu {...baseProps}/>,
            stateWithCloudFree,
        );

        screen.getByText(currentTeam.display_name).click();

        await waitFor(() => {
            expect(screen.getByText('Create a team')).toBeInTheDocument();

            // Verify the RestrictedIndicator is rendered
            expect(document.querySelector('.RestrictedIndicator__icon-tooltip')).toBeInTheDocument();
        });
    });
});

