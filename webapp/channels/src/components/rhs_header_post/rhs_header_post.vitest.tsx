// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CollapsedThreads} from '@mattermost/types/config';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {WindowSizes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import RhsHeaderPost from './index';

describe('rhs_header_post', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'root-portal';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild<HTMLDivElement>(container);
    });
    const initialState = {
        entities: {
            users: {
                currentUserId: '12',
                profiles: {
                    12: {
                        username: 'jessica.hyde',
                        notify_props: {
                            mention_keys: 'jessicahyde,Jessica Hyde',
                        },
                    },
                },
            },
            teams: {
                teams: {},
                currentTeamId: '22',
            },
            general: {
                config: {
                    FeatureFlagCollapsedThreads: 'true',
                    CollapsedThreads: CollapsedThreads.DEFAULT_OFF,
                },
            },
            preferences: {
                myPreferences: {
                    [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.COLLAPSED_REPLY_THREADS}`]: {
                        value: 'on',
                    },
                },
            },
            posts: {
                posts: {
                    42: TestHelper.getPostMock({
                        id: '42',
                        message: 'where is @jessica.hyde?',
                    }),
                    43: TestHelper.getPostMock({
                        id: '43',
                        message: 'not a mention',
                    }),
                },
            },
            threads: {
                threads: {
                    42: {
                        id: '42',
                        reply_count: 0,
                        is_following: null as any, // This is supposed to be boolean based on the type definitions, but this relies on this being null in some cases
                    },
                    43: {
                        id: '43',
                        reply_count: 0,
                        is_following: null as any, // This is supposed to be boolean based on the type definitions, but this relies on this being null in some cases
                    },
                },
            },
        },
        views: {
            rhs: {
                isSidebarExpanded: false,
            },
            browser: {
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
        },
    };

    const baseProps = {
        channel: TestHelper.getChannelMock(),
        currentChannelId: '32',
        rootPostId: '42',
        showMentions: vi.fn(),
        showFlaggedPosts: vi.fn(),
        showPinnedPosts: vi.fn(),
        closeRightHandSide: vi.fn(),
        toggleRhsExpanded: vi.fn(),
        setThreadFollow: vi.fn(),
    };

    test('should not crash when no root', () => {
        renderWithContext(
            <RhsHeaderPost
                {...baseProps}
                rootPostId='41'
            />,
            initialState,
        );

        // FollowButton should render with isFollowing=false (shows "Follow" text, not "Following")
        const followButton = screen.getByRole('button', {name: 'Follow'});
        expect(followButton).toBeInTheDocument();
    });

    test('should not show following when no replies and not mentioned', () => {
        renderWithContext(
            <RhsHeaderPost
                {...baseProps}
                rootPostId='43'
            />,
            initialState,
        );

        // FollowButton should render with isFollowing=false (shows "Follow" text, not "Following")
        const followButton = screen.getByRole('button', {name: 'Follow'});
        expect(followButton).toBeInTheDocument();
    });

    test('should show following when no replies but user is mentioned', () => {
        renderWithContext(
            <RhsHeaderPost
                {...baseProps}
                rootPostId='42'
            />,
            initialState,
        );

        // FollowButton should render with isFollowing=true (shows "Following" text, not "Follow")
        const followingButton = screen.getByRole('button', {name: 'Following'});
        expect(followingButton).toBeInTheDocument();
    });
});
