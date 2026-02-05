// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import TeamList from '../team_list';

jest.mock('selectors/views/guilded_layout', () => ({
    getFavoritedTeamIds: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeamId: jest.fn(),
    getMyTeams: jest.fn(),
}));

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

const mockGetFavoritedTeamIds = getFavoritedTeamIds as jest.Mock;
const mockGetCurrentTeamId = getCurrentTeamId as jest.Mock;
const mockGetMyTeams = getMyTeams as jest.Mock;

const mockStore = configureStore([]);

describe('TeamList', () => {
    const defaultProps = {
        onTeamClick: jest.fn(),
    };

    const allTeams = [
        {id: 'team1', display_name: 'Alpha Team', name: 'alpha-team', last_team_icon_update: 0, delete_at: 0},
        {id: 'team2', display_name: 'Beta Team', name: 'beta-team', last_team_icon_update: 0, delete_at: 0},
        {id: 'team3', display_name: 'Gamma Team', name: 'gamma-team', last_team_icon_update: 0, delete_at: 0},
    ];

    const baseState = {
        entities: {
            teams: {
                teams: {},
                myMembers: {},
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
        mockGetCurrentTeamId.mockReturnValue('team1');
        mockGetFavoritedTeamIds.mockReturnValue(['team1']);
        mockGetMyTeams.mockReturnValue(allTeams);
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
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        expect(teamButtons).toHaveLength(3);
    });

    it('sorts teams alphabetically by display name', () => {
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
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        const initials = Array.from(teamButtons).map((btn) => btn.textContent);
        expect(initials).toEqual(['AT', 'BT', 'GT']); // Alpha, Beta, Gamma
    });

    it('highlights current team if in list', () => {
        // Make team2 current and not favorited
        mockGetCurrentTeamId.mockReturnValue('team2');
        mockGetFavoritedTeamIds.mockReturnValue(['team1']);
        const store = mockStore({
            ...baseState,
            entities: {
                ...baseState.entities,
                teams: {
                    ...baseState.entities.teams,
                    currentTeamId: 'team2',
                },
            },
        });
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__team--active')).toBeInTheDocument();
    });
});
