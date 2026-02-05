// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import FavoritedTeams from '../favorited_teams';

const mockStore = configureStore([]);

describe('FavoritedTeams', () => {
    const defaultProps = {
        onTeamClick: jest.fn(),
        onExpandClick: jest.fn(),
    };

    const baseState = {
        entities: {
            teams: {
                teams: {
                    team1: {id: 'team1', display_name: 'Team One', name: 'team-one', last_team_icon_update: 0},
                    team2: {id: 'team2', display_name: 'Team Two', name: 'team-two', last_team_icon_update: 0},
                    team3: {id: 'team3', display_name: 'Team Three', name: 'team-three', last_team_icon_update: 0},
                },
                myMembers: {
                    team1: {team_id: 'team1'},
                    team2: {team_id: 'team2'},
                    team3: {team_id: 'team3'},
                },
                currentTeamId: 'team1',
            },
            general: {
                config: {},
            },
        },
        views: {
            guildedLayout: {
                favoritedTeamIds: ['team1', 'team2'],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders container element', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.favorited-teams')).toBeInTheDocument();
    });

    it('renders favorited team buttons', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        expect(teamButtons).toHaveLength(2);
    });

    it('renders team icons with initials', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        // Should show initials for teams without custom icons
        expect(screen.getByText('TO')).toBeInTheDocument(); // Team One
        expect(screen.getByText('TT')).toBeInTheDocument(); // Team Two
    });

    it('highlights current team', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const activeTeam = container.querySelector('.favorited-teams__team--active');
        expect(activeTeam).toBeInTheDocument();
    });

    it('calls onTeamClick when team is clicked', () => {
        const onTeamClick = jest.fn();
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} onTeamClick={onTeamClick} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        fireEvent.click(teamButtons[0]);

        expect(onTeamClick).toHaveBeenCalled();
    });

    it('renders expand button', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByRole('button', {name: /expand/i})).toBeInTheDocument();
    });

    it('calls onExpandClick when expand button is clicked', () => {
        const onExpandClick = jest.fn();
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} onExpandClick={onExpandClick} />
            </Provider>,
        );

        const expandButton = screen.getByRole('button', {name: /expand/i});
        fireEvent.click(expandButton);

        expect(onExpandClick).toHaveBeenCalled();
    });

    it('renders nothing when no favorited teams', () => {
        const stateWithNoFavorites = {
            ...baseState,
            views: {
                guildedLayout: {
                    favoritedTeamIds: [],
                },
            },
        };
        const store = mockStore(stateWithNoFavorites);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        expect(teamButtons).toHaveLength(0);
    });
});
