// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import TeamList from 'components/guilded_team_sidebar/team_list';

const mockStore = configureStore([]);

// Mock react-router-dom useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({
        push: mockPush,
    }),
}));

// Mock team_actions
const mockUpdateTeamsOrderForUser = jest.fn(() => ({type: 'MOCK_UPDATE_TEAMS_ORDER'}));
jest.mock('actions/team_actions', () => ({
    updateTeamsOrderForUser: (...args: any[]) => mockUpdateTeamsOrderForUser(...args),
}));

// Mock react-redux useSelector - variables must be prefixed with 'mock'
let mockCallCount = 0;
let mockValues: any[] = [];
const mockDispatch = jest.fn((action: any) => action);

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => {
        const value = mockValues[mockCallCount] ?? null;
        mockCallCount++;
        return value;
    },
    useDispatch: () => mockDispatch,
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
        mockCallCount = 0;
        mockPush.mockClear();
        mockDispatch.mockClear();
        mockUpdateTeamsOrderForUser.mockClear();
        // TeamList calls useSelector in order: getMyTeams, getFavoritedTeamIds, getCurrentTeamId, isDmMode, locale, userTeamsOrderPreference, getTeamsUnreadStatuses
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(), new Map(), new Map()]];
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
        mockCallCount = 0;
        mockValues = [allTeams, [], 'team1', false, 'en', '', [new Set(), new Map(), new Map()]];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        expect(teamButtons).toHaveLength(3);
    });

    it('sorts teams alphabetically by display name when no custom order', () => {
        mockCallCount = 0;
        mockValues = [allTeams, [], 'team1', false, 'en', '', [new Set(), new Map(), new Map()]];

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

    it('respects user team order preference', () => {
        mockCallCount = 0;
        // Custom order: Gamma, Beta, Alpha - with team1 (Alpha) favorited, expect Gamma then Beta
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', 'team3,team2,team1', [new Set(), new Map(), new Map()]];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        const teamButtons = container.querySelectorAll('.team-list__team');
        const initials = Array.from(teamButtons).map((btn) => btn.textContent);
        expect(initials).toEqual(['GT', 'BT']); // Gamma, Beta (Alpha is favorited)
    });

    it('highlights current team if in list', () => {
        mockCallCount = 0;
        mockValues = [allTeams, ['team1'], 'team2', false, 'en', '', [new Set(), new Map(), new Map()]];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__team--active')).toBeInTheDocument();
    });

    it('navigates to team when clicked', () => {
        mockCallCount = 0;
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(), new Map(), new Map()]];

        const onTeamClick = jest.fn();
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} onTeamClick={onTeamClick} />
            </Provider>,
        );

        // Beta Team should be the first non-favorited team (alphabetically)
        const teamButtons = container.querySelectorAll('.team-list__team');
        fireEvent.click(teamButtons[0]); // Click Beta Team

        // Should navigate to the team's default channel
        expect(mockPush).toHaveBeenCalledWith('/beta-team/channels/town-square');
        expect(onTeamClick).toHaveBeenCalled();
    });

    it('shows unread dot for teams with unread messages', () => {
        mockCallCount = 0;
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(['team2']), new Map(), new Map()]];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__unread-badge')).toBeInTheDocument();
    });

    it('shows mention badge with count', () => {
        mockCallCount = 0;
        const mentions = new Map([['team2', 5]]);
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(['team2']), mentions, new Map()]];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows 99+ when mentions exceed 99', () => {
        mockCallCount = 0;
        const mentions = new Map([['team2', 150]]);
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(['team2']), mentions, new Map()]];

        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('shows mention badge instead of unread dot when team has mentions', () => {
        mockCallCount = 0;
        const mentions = new Map([['team2', 3]]);
        mockValues = [allTeams, ['team1'], 'team1', false, 'en', '', [new Set(['team2']), mentions, new Map()]];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        // Mention badge shown, not unread dot
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(container.querySelector('.team-list__unread-badge')).not.toBeInTheDocument();
    });

    it('does not show badges when team has no unreads', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <TeamList {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.team-list__unread-badge')).not.toBeInTheDocument();
        expect(container.querySelector('.team-list__mention-badge')).not.toBeInTheDocument();
    });
});
