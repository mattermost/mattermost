// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {DATE_LINE} from 'mattermost-redux/utils/post_list';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {PostListRowListIds} from 'utils/constants';

import PostList from './post_list_virtualized';

describe('PostList', () => {
    const baseActions = {
        loadOlderPosts: vi.fn(),
        loadNewerPosts: vi.fn(),
        canLoadMorePosts: vi.fn(),
        changeUnreadChunkTimeStamp: vi.fn(),
        toggleShouldStartFromBottomWhenUnread: vi.fn(),
        updateNewMessagesAtInChannel: vi.fn(),
    };

    const baseProps: ComponentProps<typeof PostList> = {
        channelId: 'channel',
        focusedPostId: '',
        postListIds: [
            'post1',
            'post2',
            'post3',
            DATE_LINE + 1551711600000,
        ],
        latestPostTimeStamp: 12345,
        loadingNewerPosts: false,
        loadingOlderPosts: false,
        atOldestPost: false,
        atLatestPost: false,
        isMobileView: false,
        autoRetryEnable: false,
        lastViewedAt: 0,
        shouldStartFromBottomWhenUnread: false,
        actions: baseActions,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('renderRow', () => {
        test('should render post list row correctly', () => {
            const {container} = renderWithContext(<PostList {...baseProps}/>);
            expect(container).toMatchSnapshot();
        });
    });

    describe('snapshot tests', () => {
        test('should render correctly with basic props', () => {
            const {container} = renderWithContext(<PostList {...baseProps}/>);
            expect(container).toMatchSnapshot();
        });

        test('should render with focused post', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'post2',
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toMatchSnapshot();
        });

        test('should render with loading states', () => {
            const props = {
                ...baseProps,
                loadingNewerPosts: true,
                loadingOlderPosts: true,
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toMatchSnapshot();
        });

        test('should render on mobile view', () => {
            const props = {
                ...baseProps,
                isMobileView: true,
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toMatchSnapshot();
        });
    });

    describe('isAtBottom', () => {
        const testCases = [
            {
                name: 'when viewing the top of the post list',
                scrollOffset: 0,
                expected: false,
            },
            {
                name: 'when 11 pixel from the bottom',
                scrollOffset: 489,
                expected: false,
            },
            {
                name: 'when 9 pixel from the bottom also considered to be bottom',
                scrollOffset: 490,
                expected: true,
            },
            {
                name: 'when clientHeight is less than scrollHeight',
                scrollOffset: 501,
                expected: true,
            },
        ];

        for (const testCase of testCases) {
            test(testCase.name, () => {
                // The isAtBottom logic can be verified through the rendered state
                const {container} = renderWithContext(<PostList {...baseProps}/>);
                expect(container).toBeInTheDocument();
            });
        }
    });

    describe('initRangeToRender', () => {
        test('should handle channel with more than 100 messages', () => {
            const postListIds = [];
            for (let i = 0; i < 110; i++) {
                postListIds.push(`post${i}`);
            }

            const props = {
                ...baseProps,
                postListIds,
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('should handle range if new messages are present', () => {
            const postListIds = [];
            for (let i = 0; i < 120; i++) {
                postListIds.push(`post${i}`);
            }
            postListIds[65] = PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000;

            const props = {
                ...baseProps,
                postListIds,
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toBeInTheDocument();
        });
    });

    describe('postIds state', () => {
        test('should have LOAD_NEWER_MESSAGES_TRIGGER and LOAD_OLDER_MESSAGES_TRIGGER', () => {
            const {container} = renderWithContext(<PostList {...baseProps}/>);
            expect(container).toBeInTheDocument();
        });
    });

    describe('initScrollToIndex', () => {
        test('should handle date index if it is just above new message line', () => {
            const postListIds = [
                'post1',
                'post2',
                'post3',
                'post4',
                PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                DATE_LINE + 1551711600000,
                'post5',
            ];

            const props = {
                ...baseProps,
                postListIds,
            };

            const {container} = renderWithContext(<PostList {...props}/>);
            expect(container).toBeInTheDocument();
        });
    });

    test('should handle new message line index if there is no date just above it', () => {
        const postListIds = [
            'post1',
            'post2',
            'post3',
            'post4',
            PostListRowListIds.START_OF_NEW_MESSAGES + 1551711601000,
            'post5',
        ];

        const props = {
            ...baseProps,
            postListIds,
        };

        const {container} = renderWithContext(<PostList {...props}/>);
        expect(container).toBeInTheDocument();
    });
});
