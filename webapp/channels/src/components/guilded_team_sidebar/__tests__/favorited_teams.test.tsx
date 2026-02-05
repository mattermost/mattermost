// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import FavoritedTeams from '../favorited_teams';

jest.mock('selectors/views/guilded_layout', () => ({
    getFavoritedTeamIds: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeamId: jest.fn(),
    getTeam: jest.fn(),
}));

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';
import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';

const mockGetFavoritedTeamIds = getFavoritedTeamIds as jest.Mock;
const mockGetCurrentTeamId = getCurrentTeamId as jest.Mock;
const mockGetTeam = getTeam as jest.Mock;

const mockStore = configureStore([]);

describe('FavoritedTeams', () => {
    const defaultProps = {
        onTeamClick: jest.fn(),
        onExpandClick: jest.fn(),
    };

    const mockTeams = {
        team1: {id: 'team1', display_name: 'Team One', name: 'team-one', last_team_icon_update: 0, delete_at: 0},
        team2: {id: 'team2', display_name: 'Team Two', name: 'team-two', last_team_icon_update: 0, delete_at: 0},
    };

    const baseState = {
        entities: {
            teams: {
                teams: mockTeams,
                myMembers: {
                    team1: {team_id: 'team1'},
                    team2: {team_id: 'team2'},
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
        mockGetCurrentTeamId.mockReturnValue('team1');
        mockGetFavoritedTeamIds.mockReturnValue(['team1', 'team2']);
        mockGetTeam.mockImplementation((state, id) => mockTeams[id as keyof typeof mockTeams] || null);
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
        mockGetFavoritedTeamIds.mockReturnValue([]);
        const store = mockStore({
            ...baseState,
            views: {
                guildedLayout: {
                    favoritedTeamIds: [],
                },
            },
        });
        const {container} = render(
            <Provider store={store}>
                <FavoritedTeams {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.favorited-teams__team');
        expect(teamButtons).toHaveLength(0);
    });
});
