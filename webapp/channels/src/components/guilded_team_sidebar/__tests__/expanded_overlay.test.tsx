// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import ExpandedOverlay from '../expanded_overlay';

const mockStore = configureStore([]);

describe('ExpandedOverlay', () => {
    const defaultProps = {
        onClose: jest.fn(),
    };

    const baseState = {
        entities: {
            teams: {
                teams: {
                    team1: {id: 'team1', display_name: 'Team One', name: 'team-one', last_team_icon_update: 0},
                    team2: {id: 'team2', display_name: 'Team Two', name: 'team-two', last_team_icon_update: 0},
                },
                myMembers: {
                    team1: {team_id: 'team1'},
                    team2: {team_id: 'team2'},
                },
                currentTeamId: 'team1',
            },
            channels: {
                channels: {
                    dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                },
                myMembers: {
                    dm1: {channel_id: 'dm1', mention_count: 2},
                },
            },
            users: {
                profiles: {
                    user2: {id: 'user2', username: 'johndoe', first_name: 'John', last_name: 'Doe', last_picture_update: 0},
                },
                statuses: {
                    user2: 'online',
                },
                currentUserId: 'currentUser',
            },
            general: {
                config: {},
            },
        },
        views: {
            guildedLayout: {
                favoritedTeamIds: ['team1'],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
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
        render(
            <Provider store={store}>
                <ExpandedOverlay {...defaultProps} />
            </Provider>,
        );

        expect(screen.getByText(/teams/i)).toBeInTheDocument();
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
