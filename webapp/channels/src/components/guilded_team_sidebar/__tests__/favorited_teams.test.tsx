// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import FavoritedTeams from '../favorited_teams';

const mockStore = configureStore([]);

// Mock react-redux useSelector - variables must be prefixed with 'mock'
let mockCallCount = 0;
let mockValues: any[] = [];

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const value = mockValues[mockCallCount] ?? null;
        mockCallCount++;
        return value;
    },
}));

describe('FavoritedTeams', () => {
    const defaultProps = {
        onTeamClick: jest.fn(),
        onExpandClick: jest.fn(),
    };

    const mockTeams = [
        {id: 'team1', display_name: 'Team One', name: 'team-one', last_team_icon_update: 0, delete_at: 0},
        {id: 'team2', display_name: 'Team Two', name: 'team-two', last_team_icon_update: 0, delete_at: 0},
    ];

    const baseState = {
        entities: {
            teams: {},
            general: {config: {}},
        },
        views: {guildedLayout: {}},
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCallCount = 0;
        // FavoritedTeams calls useSelector in order: getFavoritedTeamIds, getCurrentTeamId, inline selector for teams
        mockValues = [['team1', 'team2'], 'team1', mockTeams];
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
        mockCallCount = 0;
        mockValues = [[], 'team1', []];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        expect(teamButtons).toHaveLength(0);
    });

    it('returns null (no container) when no favorited teams', () => {
        mockCallCount = 0;
        mockValues = [[], 'team1', []];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        // Should return null, not render any container
        expect(container.querySelector('.favorited-teams')).not.toBeInTheDocument();
        expect(container.querySelector('.favorited-teams__expand')).not.toBeInTheDocument();
    });
});
