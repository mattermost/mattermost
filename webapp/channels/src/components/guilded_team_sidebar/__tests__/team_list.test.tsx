// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import TeamList from '../team_list';

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
            teams: {},
            general: {config: {}},
        },
        views: {guildedLayout: {}},
    };

    beforeEach(() => {
        jest.clearAllMocks();
        useSelectorCallCount = 0;
        // TeamList calls useSelector in order: getMyTeams, getFavoritedTeamIds, getCurrentTeamId
        mockSelectorValues = [allTeams, ['team1'], 'team1'];
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
        useSelectorCallCount = 0;
        mockSelectorValues = [allTeams, [], 'team1'];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        expect(teamButtons).toHaveLength(3);
    });

    it('sorts teams alphabetically by display name', () => {
        useSelectorCallCount = 0;
        mockSelectorValues = [allTeams, [], 'team1'];

        const store = mockStore(baseState);
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
        useSelectorCallCount = 0;
        mockSelectorValues = [allTeams, ['team1'], 'team2'];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__team--active')).toBeInTheDocument();
    });
});
