// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import * as guildedLayoutSelectors from 'selectors/views/guilded_layout';

// Mock the selectors module
jest.mock('selectors/views/guilded_layout', () => ({
    ...jest.requireActual('selectors/views/guilded_layout'),
    isGuildedLayoutEnabled: jest.fn(),
}));

// Import after mocking
import TeamSidebarWrapper from '../index';

const mockStore = configureStore([]);

describe('TeamSidebar with Guilded Layout', () => {
    const singleTeamState = {
        views: {
            lhs: {
                isOpen: true,
            },
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
            },
        },
        entities: {
            teams: {
                teams: {
                    team1: {
                        id: 'team1',
                        name: 'team1',
                        display_name: 'Team 1',
                    },
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1'},
                },
                currentTeamId: 'team1',
            },
            channels: {
                channels: {},
                myMembers: {},
                channelsInTeam: {},
            },
            users: {
                profiles: {},
                statuses: {},
                currentUserId: 'user1',
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
        plugins: {
            components: {
                Product: [],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns null when not Guilded layout and only 1 team', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(false);

        const store = mockStore(singleTeamState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamSidebarWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // Standard behavior: returns null with only 1 team
        expect(container.querySelector('.team-sidebar')).not.toBeInTheDocument();
        expect(container.querySelector('.guilded-team-sidebar')).not.toBeInTheDocument();
    });

    it('renders GuildedTeamSidebar when Guilded layout enabled, even with only 1 team', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const store = mockStore(singleTeamState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamSidebarWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // In Guilded layout, should render GuildedTeamSidebar even with 1 team
        expect(container.querySelector('.guilded-team-sidebar')).toBeInTheDocument();
    });

    it('renders GuildedTeamSidebar when Guilded layout enabled with multiple teams', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const multiTeamState = {
            ...singleTeamState,
            entities: {
                ...singleTeamState.entities,
                teams: {
                    teams: {
                        team1: {id: 'team1', name: 'team1', display_name: 'Team 1'},
                        team2: {id: 'team2', name: 'team2', display_name: 'Team 2'},
                    },
                    myMembers: {
                        team1: {team_id: 'team1', user_id: 'user1'},
                        team2: {team_id: 'team2', user_id: 'user1'},
                    },
                    currentTeamId: 'team1',
                },
            },
        };

        const store = mockStore(multiTeamState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamSidebarWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // In Guilded layout with multiple teams, should still render GuildedTeamSidebar
        expect(container.querySelector('.guilded-team-sidebar')).toBeInTheDocument();
    });

    it('renders standard TeamSidebar when not Guilded layout with multiple teams', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(false);

        const multiTeamState = {
            ...singleTeamState,
            entities: {
                ...singleTeamState.entities,
                teams: {
                    teams: {
                        team1: {id: 'team1', name: 'team1', display_name: 'Team 1'},
                        team2: {id: 'team2', name: 'team2', display_name: 'Team 2'},
                    },
                    myMembers: {
                        team1: {team_id: 'team1', user_id: 'user1'},
                        team2: {team_id: 'team2', user_id: 'user1'},
                    },
                    currentTeamId: 'team1',
                },
            },
        };

        const store = mockStore(multiTeamState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <TeamSidebarWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // Standard behavior with multiple teams: renders standard team-sidebar
        expect(container.querySelector('.team-sidebar')).toBeInTheDocument();
    });
});
