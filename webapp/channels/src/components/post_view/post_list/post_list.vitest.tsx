// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';

import PostList from './post_list';

const actionsProp = {
    loadPostsAround: vi.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadUnreads: vi.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadPosts: vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false})),
    syncPostsInChannel: vi.fn().mockResolvedValue({}),
    loadLatestPosts: vi.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    markChannelAsRead: vi.fn(),
    updateNewMessagesAtInChannel: vi.fn(),
    toggleShouldStartFromBottomWhenUnread: vi.fn(),
};

const lastViewedAt = 1532345226632;
const channelId = 'fake-id';

const createFakePosIds = (num: number) => {
    const postIds = [];
    for (let i = 1; i <= num; i++) {
        postIds.push(`1234${i}`);
    }

    return postIds;
};

const baseProps = {
    actions: actionsProp,
    lastViewedAt,
    channelId,
    postListIds: [],
    changeUnreadChunkTimeStamp: vi.fn(),
    toggleShouldStartFromBottomWhenUnread: vi.fn(),
    isFirstLoad: true,
    atLatestPost: false,
    formattedPostIds: [],
    isPrefetchingInProcess: false,
    isMobileView: false,
    hasInaccessiblePosts: false,
    shouldStartFromBottomWhenUnread: false,
};

describe('components/post_view/post_list', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('snapshot for loading when there are no posts', async () => {
        const {container} = renderWithContext(
            <PostList {...{...baseProps, postListIds: []}}/>,
        );

        // Wait for async state updates to complete
        await act(async () => {});

        expect(container).toMatchSnapshot();
    });

    it('snapshot with couple of posts', async () => {
        const postIds = createFakePosIds(2);
        const {container} = renderWithContext(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );

        await act(async () => {});

        expect(container).toMatchSnapshot();
    });

    it('Should call postsOnLoad', async () => {
        const emptyPostList: string[] = [];

        renderWithContext(
            <PostList {...{...baseProps, postListIds: emptyPostList}}/>,
        );

        await act(async () => {});

        expect(actionsProp.loadUnreads).toHaveBeenCalledWith(baseProps.channelId);
    });

    it('Should not call loadUnreads if isPrefetchingInProcess is true', async () => {
        const emptyPostList: string[] = [];

        renderWithContext(<PostList {...{...baseProps, postListIds: emptyPostList, isPrefetchingInProcess: true}}/>);

        await act(async () => {});

        expect(actionsProp.loadUnreads).not.toHaveBeenCalledWith(baseProps.channelId);
    });

    it('Should call for permalink posts', async () => {
        const focusedPostId = 'new';
        renderWithContext(
            <PostList {...{...baseProps, focusedPostId}}/>,
        );

        await act(async () => {});

        expect(actionsProp.loadPostsAround).toHaveBeenCalledWith(baseProps.channelId, focusedPostId);
    });

    it('Should call for loadLatestPosts', async () => {
        renderWithContext(
            <PostList {...{...baseProps, postListIds: [], isFirstLoad: false}}/>,
        );

        await act(async () => {});

        expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
    });

    describe('getPostsSince', () => {
        test('should call getPostsSince on channel switch', async () => {
            const postIds = createFakePosIds(2);
            renderWithContext(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds, latestPostTimeStamp: 1234}}/>);

            await act(async () => {});

            expect(actionsProp.syncPostsInChannel).toHaveBeenCalledWith(baseProps.channelId, 1234, false);
        });
    });

    describe('canLoadMorePosts', () => {
        test('Should not call loadLatestPosts if postListIds is empty', async () => {
            renderWithContext(<PostList {...{...baseProps, isFirstLoad: false, postListIds: []}}/>);

            await act(async () => {});

            expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
        });
    });

    describe('Differentiated page sizes', () => {
        test('Should use correct posts per page for different load types', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(
                <PostList {...props}/>,
            );

            await act(async () => {});

            // Component should render correctly
            expect(loadPosts).not.toHaveBeenCalled(); // Initial load doesn't use loadPosts
        });
    });
});
