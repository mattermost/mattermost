// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import ExpandedOverlay from 'components/guilded_team_sidebar/expanded_overlay';

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

describe('ExpandedOverlay', () => {
    const defaultProps = {
        onClose: jest.fn(),
    };

    const mockTeams = [
        {id: 'team1', display_name: 'Team One', name: 'team-one', last_team_icon_update: 0, delete_at: 0},
        {id: 'team2', display_name: 'Team Two', name: 'team-two', last_team_icon_update: 0, delete_at: 0},
    ];

    const mockUnreadDms = [
        {
            channel: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
            user: {id: 'user2', username: 'johndoe', first_name: 'John', last_name: 'Doe', last_picture_update: 0},
            unreadCount: 2,
            status: 'online',
        },
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
        // ExpandedOverlay calls useSelector in order: getMyTeams, getFavoritedTeamIds, getCurrentTeamId, getUnreadDmChannelsWithUsers, locale, userTeamsOrderPreference
        mockValues = [mockTeams, ['team1'], 'team1', mockUnreadDms, 'en', ''];
    });

    it('renders the overlay container', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay')).toBeInTheDocument();
    });

    it('renders close button', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByRole('button', {name: /close/i})).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', () => {
        const onClose = jest.fn();
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} onClose={onClose} />
            </Provider>,
        );

        const closeButton = screen.getByRole('button', {name: /close/i});
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('renders teams section', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        // Check for teams section header
        expect(container.querySelector('.expanded-overlay__section')).toBeInTheDocument();
    });

    it('renders team names in expanded view', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByText('Team One')).toBeInTheDocument();
        expect(screen.getByText('Team Two')).toBeInTheDocument();
    });

    it('renders DM section with unread DMs', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByText(/direct messages/i)).toBeInTheDocument();
    });

    it('shows user names for unread DMs', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        // Should show user's display name or username
        expect(screen.getByText(/john/i)).toBeInTheDocument();
    });

    it('shows unread count badge for DMs', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay__badge')).toBeInTheDocument();
    });

    it('indicates favorite teams with star icon', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay__favorite-indicator')).toBeInTheDocument();
    });

    it('sorts teams using user preference order', () => {
        const threeTeams = [
            {id: 'team1', display_name: 'Alpha', name: 'alpha', last_team_icon_update: 0, delete_at: 0},
            {id: 'team2', display_name: 'Beta', name: 'beta', last_team_icon_update: 0, delete_at: 0},
            {id: 'team3', display_name: 'Gamma', name: 'gamma', last_team_icon_update: 0, delete_at: 0},
        ];

        mockCallCount = 0;
        // Custom order: team3, team1, team2 — with team1 favorited, expect: team1 (fav first), team3, team2
        mockValues = [threeTeams, ['team1'], 'team1', [], 'en', 'team3,team1,team2'];

        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        const teamNames = container.querySelectorAll('.expanded-overlay__team-name');
        const names = Array.from(teamNames).map((el) => el.textContent);
        expect(names).toEqual(['Alpha', 'Gamma', 'Beta']); // Favorited (Alpha) first, then Gamma, Beta per custom order
    });

    it('renders header with title', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(container.querySelector('.expanded-overlay__header')).toBeInTheDocument();
    });
});
