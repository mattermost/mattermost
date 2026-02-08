// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import GuildedTeamSidebar from 'components/guilded_team_sidebar/index';

const mockStore = configureStore([]);

const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockPush,
    }),
}));

// Mock the child components to avoid selector issues
jest.mock('components/guilded_team_sidebar/dm_button', () => ({onClick}: {onClick: () => void}) => (
    <button aria-label="Direct Messages" onClick={onClick}>DM</button>
));
jest.mock('components/guilded_team_sidebar/unread_dm_avatars', () => () => <div className="unread-dm-avatars" />);
jest.mock('components/guilded_team_sidebar/favorited_teams', () => ({onTeamClick, onExpandClick}: any) => (
    <div className="favorited-teams">
        <button onClick={onExpandClick}>Expand</button>
    </div>
));
jest.mock('components/guilded_team_sidebar/team_list', () => () => <div className="team-list" />);
jest.mock('components/guilded_team_sidebar/expanded_overlay', () => ({onClose}: any) => (
    <div className="expanded-overlay">
        <button onClick={onClose}>Close</button>
    </div>
));

function renderWithIntl(component: React.ReactElement) {
    return render(
        <IntlProvider locale='en'>
            {component}
        </IntlProvider>,
    );
}

describe('GuildedTeamSidebar', () => {
    const defaultState = {
        views: {
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
            },
        },
        entities: {
            teams: {
                teams: {},
                myMembers: {},
                currentTeamId: 'team1',
            },
            channels: {
                channels: {},
                myMembers: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: 'system_user',
                    },
                },
                statuses: {},
            },
            general: {
                config: {},
                serverVersion: '',
            },
            roles: {
                roles: {
                    system_user: {permissions: []},
                },
            },
        },
    };

    beforeEach(() => {
        mockPush.mockClear();
    });

    it('renders the collapsed sidebar container', () => {
        const store = mockStore(defaultState);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        expect(container.querySelector('.guilded-team-sidebar')).toBeInTheDocument();
        expect(container.querySelector('.guilded-team-sidebar__collapsed')).toBeInTheDocument();
    });

    it('has team-sidebar class for CSS Grid positioning', () => {
        const store = mockStore(defaultState);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        // Must have team-sidebar class to be positioned correctly in the app grid layout
        expect(container.querySelector('.team-sidebar')).toBeInTheDocument();
    });

    it('renders DM button', () => {
        const store = mockStore(defaultState);

        renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        expect(screen.getByRole('button', {name: /direct messages/i})).toBeInTheDocument();
    });

    it('renders at least one divider (after DM section)', () => {
        const store = mockStore(defaultState);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        const dividers = container.querySelectorAll('.guilded-team-sidebar__divider');
        // At minimum, there's one divider after DM button section
        // Second divider only renders when there are favorited teams
        expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('renders two dividers when there are favorited teams', () => {
        const stateWithFavorites = {
            ...defaultState,
            views: {
                ...defaultState.views,
                guildedLayout: {
                    ...defaultState.views.guildedLayout,
                    favoritedTeamIds: ['team1'],
                },
            },
        };
        const store = mockStore(stateWithFavorites);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        const dividers = container.querySelectorAll('.guilded-team-sidebar__divider');
        // DM divider + favorites divider + create-btn divider = 3
        expect(dividers.length).toBe(3);
    });

    it('shows expanded overlay when isTeamSidebarExpanded is true', () => {
        const expandedState = {
            ...defaultState,
            views: {
                ...defaultState.views,
                guildedLayout: {
                    ...defaultState.views.guildedLayout,
                    isTeamSidebarExpanded: true,
                },
            },
        };
        const store = mockStore(expandedState);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay')).toBeInTheDocument();
    });

    it('does not show expanded overlay when collapsed', () => {
        const store = mockStore(defaultState);

        const {container} = renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay')).not.toBeInTheDocument();
    });

    it('dispatches setDmMode when DM button clicked', () => {
        const store = mockStore(defaultState);

        renderWithIntl(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>,
        );

        const dmButton = screen.getByRole('button', {name: /direct messages/i});
        fireEvent.click(dmButton);

        const actions = store.getActions();
        expect(actions).toContainEqual(expect.objectContaining({
            type: 'GUILDED_SET_DM_MODE',
            isDmMode: true,
        }));
    });

    describe('Create/Join Team button', () => {
        it('shows "Create a Team" button when user has CREATE_TEAM permission and no joinable teams', () => {
            const stateWithPermission = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    users: {
                        ...defaultState.entities.users,
                        currentUserId: 'user1',
                        profiles: {
                            user1: {
                                id: 'user1',
                                roles: 'system_admin',
                            },
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: {permissions: ['create_team']},
                        },
                    },
                },
            };
            const store = mockStore(stateWithPermission);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const createBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            expect(createBtn).toBeInTheDocument();
            expect(createBtn).toHaveAttribute('title', 'Create a Team');
        });

        it('navigates to /create_team when create button is clicked', () => {
            const stateWithPermission = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    users: {
                        ...defaultState.entities.users,
                        currentUserId: 'user1',
                        profiles: {
                            user1: {
                                id: 'user1',
                                roles: 'system_admin',
                            },
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: {permissions: ['create_team']},
                        },
                    },
                },
            };
            const store = mockStore(stateWithPermission);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const createBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            fireEvent.click(createBtn!);

            expect(mockPush).toHaveBeenCalledWith('/create_team');
        });

        it('does not show create button when user lacks CREATE_TEAM permission and no joinable teams', () => {
            // defaultState has system_user role with no permissions
            const store = mockStore(defaultState);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const createBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            expect(createBtn).not.toBeInTheDocument();
        });

        it('shows "Other teams you can join" button when there are joinable teams', () => {
            const stateWithJoinableTeams = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    teams: {
                        ...defaultState.entities.teams,
                        teams: {
                            team1: {id: 'team1', name: 'my-team', display_name: 'My Team', delete_at: 0, allow_open_invite: true},
                            team2: {id: 'team2', name: 'other-team', display_name: 'Other Team', delete_at: 0, allow_open_invite: true},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                        },
                    },
                },
            };
            const store = mockStore(stateWithJoinableTeams);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const joinBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            expect(joinBtn).toBeInTheDocument();
            expect(joinBtn).toHaveAttribute('title', 'Other teams you can join');
        });

        it('navigates to /select_team when join button is clicked', () => {
            const stateWithJoinableTeams = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    teams: {
                        ...defaultState.entities.teams,
                        teams: {
                            team1: {id: 'team1', name: 'my-team', display_name: 'My Team', delete_at: 0, allow_open_invite: true},
                            team2: {id: 'team2', name: 'other-team', display_name: 'Other Team', delete_at: 0, allow_open_invite: true},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                        },
                    },
                },
            };
            const store = mockStore(stateWithJoinableTeams);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const joinBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            fireEvent.click(joinBtn!);

            expect(mockPush).toHaveBeenCalledWith('/select_team');
        });

        it('does not show join button when ExperimentalPrimaryTeam is set even with joinable teams', () => {
            const stateWithPrimaryTeam = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    teams: {
                        ...defaultState.entities.teams,
                        teams: {
                            team1: {id: 'team1', name: 'my-team', display_name: 'My Team', delete_at: 0, allow_open_invite: true},
                            team2: {id: 'team2', name: 'other-team', display_name: 'Other Team', delete_at: 0, allow_open_invite: true},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                        },
                    },
                    general: {
                        config: {
                            ExperimentalPrimaryTeam: 'my-team',
                        },
                        serverVersion: '',
                    },
                },
            };
            const store = mockStore(stateWithPrimaryTeam);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            // Should not show the join button (would fall through to create, but user has no permission)
            const btn = container.querySelector('.guilded-team-sidebar__create-btn');
            expect(btn).not.toBeInTheDocument();
        });

        it('shows create button (not join) when ExperimentalPrimaryTeam is set and user has CREATE_TEAM', () => {
            const stateWithPrimaryTeamAndPermission = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    teams: {
                        ...defaultState.entities.teams,
                        teams: {
                            team1: {id: 'team1', name: 'my-team', display_name: 'My Team', delete_at: 0, allow_open_invite: true},
                            team2: {id: 'team2', name: 'other-team', display_name: 'Other Team', delete_at: 0, allow_open_invite: true},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                        },
                    },
                    general: {
                        config: {
                            ExperimentalPrimaryTeam: 'my-team',
                        },
                        serverVersion: '',
                    },
                    users: {
                        ...defaultState.entities.users,
                        currentUserId: 'user1',
                        profiles: {
                            user1: {
                                id: 'user1',
                                roles: 'system_admin',
                            },
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: {permissions: ['create_team']},
                        },
                    },
                },
            };
            const store = mockStore(stateWithPrimaryTeamAndPermission);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const createBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            expect(createBtn).toBeInTheDocument();
            expect(createBtn).toHaveAttribute('title', 'Create a Team');
        });

        it('supports keyboard navigation on create button', () => {
            const stateWithPermission = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    users: {
                        ...defaultState.entities.users,
                        currentUserId: 'user1',
                        profiles: {
                            user1: {
                                id: 'user1',
                                roles: 'system_admin',
                            },
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: {permissions: ['create_team']},
                        },
                    },
                },
            };
            const store = mockStore(stateWithPermission);

            const {container} = renderWithIntl(
                <Provider store={store}>
                    <GuildedTeamSidebar />
                </Provider>,
            );

            const createBtn = container.querySelector('.guilded-team-sidebar__create-btn');
            fireEvent.keyDown(createBtn!, {key: 'Enter'});

            expect(mockPush).toHaveBeenCalledWith('/create_team');
        });
    });
});
