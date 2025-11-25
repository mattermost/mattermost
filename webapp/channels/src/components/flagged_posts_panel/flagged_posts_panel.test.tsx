// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import FlaggedPostsPanel from './flagged_posts_panel';
import type {Props} from './types';

describe('components/flagged_posts_panel', () => {
    const defaultProps: Props = {
        posts: [],
        isLoading: false,
        isLoadingMore: false,
        isEnd: false,
        actions: {
            getMoreFlaggedPosts: jest.fn(),
        },
    };

    const baseState = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {id: 'user1', username: 'user1', email: 'user1@test.com'},
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'team1'},
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1'},
                },
            },
            channels: {
                currentChannelId: 'channel1',
                channels: {
                    channel1: {id: 'channel1', name: 'channel1', team_id: 'team1', display_name: 'Channel 1', type: General.OPEN_CHANNEL},
                },
                myMembers: {
                    channel1: {channel_id: 'channel1', user_id: 'user1'},
                },
                channelsInTeam: {
                    team1: new Set(['channel1']),
                },
            },
            preferences: {
                myPreferences: {},
            },
            general: {
                config: {},
            },
            roles: {
                roles: {},
            },
            emojis: {
                customEmoji: {},
            },
        },
        views: {
            rhs: {
                rhsState: 'flag',
            },
        },
    };

    test('should render loading state', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: true,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(screen.getByText('Searching')).toBeInTheDocument();
    });

    test('should render empty state when no posts', () => {
        const props: Props = {
            ...defaultProps,
            posts: [],
            isLoading: false,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        // The NoResultsIndicator for FlaggedPosts displays "Save Message" instruction
        expect(screen.getByText('Save Message')).toBeInTheDocument();
    });

    test('should render header title', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: false,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(screen.getByText('Saved messages')).toBeInTheDocument();
    });

    test('should render panel with correct id', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: false,
        };

        const {container} = renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(container.querySelector('#flaggedPostsPanel')).toBeInTheDocument();
    });

    test('should render flagged posts container', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: false,
        };

        const {container} = renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(container.querySelector('#flagged-posts-container')).toBeInTheDocument();
    });

    test('should render close button in header', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: false,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    test('should render expand button in header', () => {
        const props: Props = {
            ...defaultProps,
            isLoading: false,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        expect(screen.getByLabelText('Expand Sidebar Icon')).toBeInTheDocument();
    });

    test('should not show empty state when loading', () => {
        const props: Props = {
            ...defaultProps,
            posts: [],
            isLoading: true,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        // Should show loading, not empty state
        expect(screen.getByText('Searching')).toBeInTheDocument();
        expect(screen.queryByText('No saved messages yet')).not.toBeInTheDocument();
    });

    test('should show empty state title when no posts', () => {
        const props: Props = {
            ...defaultProps,
            posts: [],
            isLoading: false,
        };

        renderWithContext(
            <FlaggedPostsPanel {...props}/>,
            baseState,
        );

        // Empty state title from NoResultsIndicator
        expect(screen.getByText('No saved messages yet')).toBeInTheDocument();
    });
});
