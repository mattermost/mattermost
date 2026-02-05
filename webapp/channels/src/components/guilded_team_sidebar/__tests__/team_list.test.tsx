// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import TeamList from '../team_list';

const mockStore = configureStore([]);

describe('TeamList', () => {
    const defaultProps = {
        onTeamClick: jest.fn(),
    };

    const baseState = {
        entities: {
            teams: {
                teams: {
                    team1: {id: 'team1', display_name: 'Alpha Team', name: 'alpha-team', last_team_icon_update: 0},
                    team2: {id: 'team2', display_name: 'Beta Team', name: 'beta-team', last_team_icon_update: 0},
                    team3: {id: 'team3', display_name: 'Gamma Team', name: 'gamma-team', last_team_icon_update: 0},
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
                favoritedTeamIds: ['team1'], // team1 is favorited, should be excluded from list
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
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list')).toBeInTheDocument();
    });

    it('renders non-favorited team buttons', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        // team1 is favorited, so only team2 and team3 should appear
        const teamButtons = container.querySelectorAll('.team-list__team');
        expect(teamButtons).toHaveLength(2);
    });

    it('renders team initials', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        // Beta Team and Gamma Team should show initials
        expect(screen.getByText('BT')).toBeInTheDocument();
        expect(screen.getByText('GT')).toBeInTheDocument();
    });

    it('does not render favorited teams', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        // Alpha Team is favorited, should not appear
        expect(screen.queryByText('AT')).not.toBeInTheDocument();
    });

    it('calls onTeamClick when team is clicked', () => {
        const onTeamClick = jest.fn();
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} onTeamClick={onTeamClick} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        fireEvent.click(teamButtons[0]);

        expect(onTeamClick).toHaveBeenCalled();
    });

    it('shows all teams when none are favorited', () => {
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
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        expect(teamButtons).toHaveLength(3);
    });

    it('sorts teams alphabetically by display name', () => {
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
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        const initials = Array.from(teamButtons).map((btn) => btn.textContent);
        expect(initials).toEqual(['AT', 'BT', 'GT']); // Alpha, Beta, Gamma
    });

    it('highlights current team if in list', () => {
        // Current team is team1, but it's favorited so won't be in list
        // Let's make team2 current instead
        const stateWithCurrentInList = {
            ...baseState,
            entities: {
                ...baseState.entities,
                teams: {
                    ...baseState.entities.teams,
                    currentTeamId: 'team2',
                },
            },
        };
        const store = mockStore(stateWithCurrentInList);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__team--active')).toBeInTheDocument();
    });
});
