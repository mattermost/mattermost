// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import FavoritedTeams from '../favorited_teams';

const mockStore = configureStore([]);

// Mock react-redux useSelector
let useSelectorCallCount = 0;
let mockSelectorValues: any[] = [];

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const value = mockSelectorValues[useSelectorCallCount] ?? null;
        useSelectorCallCount++;
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
        useSelectorCallCount = 0;
        // FavoritedTeams calls useSelector in order: getFavoritedTeamIds, getCurrentTeamId, inline selector for teams
        mockSelectorValues = [['team1', 'team2'], 'team1', mockTeams];
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
        useSelectorCallCount = 0;
        mockSelectorValues = [[], 'team1', []];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        expect(teamButtons).toHaveLength(0);
    });
});
