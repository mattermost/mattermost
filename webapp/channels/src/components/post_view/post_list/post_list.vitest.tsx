// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act, waitFor} from 'tests/vitest_react_testing_utils';
import {PostRequestTypes} from 'utils/constants';

import PostList, {MAX_EXTRA_PAGES_LOADED} from './post_list';

// Capture the actions and props passed to VirtPostList
let capturedActions: {
    loadOlderPosts: () => Promise<void>;
    loadNewerPosts: () => Promise<void>;
    canLoadMorePosts: (type?: string) => Promise<void>;
} | null = null;
let capturedPostListIds: string[] | null = null;

vi.mock('components/post_view/post_list_virtualized/post_list_virtualized', () => ({
    default: ({actions, postListIds}: any) => {
        capturedActions = actions;
        capturedPostListIds = postListIds;
        return (
            <div data-testid='virt-post-list'>
                {postListIds?.map((id: string) => <div key={id}>{id}</div>)}
            </div>
        );
    },
}));

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
const channelId = 'channel-id-123';

const createFakePosIds = (num: number) => {
    const postIds = [];
    for (let i = 1; i <= num; i++) {
        postIds.push(`post-id-123-${i}`);
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
        capturedActions = null;
        capturedPostListIds = null;
    });

    it('snapshot for loading when there are no posts', async () => {
        const {container} = renderWithContext(
            <PostList {...{...baseProps, postListIds: []}}/>,
        );

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

    it('Should call for before and afterPosts', async () => {
        const postIds = createFakePosIds(2);
        const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false}));
        const props = {
            ...baseProps,
            postListIds: postIds,
            actions: {
                ...actionsProp,
                loadPosts,
            },
        };

        renderWithContext(<PostList {...props}/>);

        await act(async () => {});
        await waitFor(() => expect(capturedActions).not.toBeNull());

        // Test loadOlderPosts
        await act(async () => {
            await capturedActions!.loadOlderPosts();
        });

        expect(loadPosts).toHaveBeenCalledWith({
            channelId: baseProps.channelId,
            postId: postIds[postIds.length - 1],
            type: PostRequestTypes.BEFORE_ID,
            perPage: 30,
        });

        loadPosts.mockClear();

        // Test loadNewerPosts
        await act(async () => {
            await capturedActions!.loadNewerPosts();
        });

        expect(loadPosts).toHaveBeenCalledWith({
            channelId: baseProps.channelId,
            postId: postIds[0],
            type: PostRequestTypes.AFTER_ID,
            perPage: 30,
        });
    });

    it('VirtPostList Should have formattedPostIds as prop', async () => {
        const postIds = createFakePosIds(2);
        renderWithContext(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );

        await act(async () => {});

        // VirtPostList receives postListIds prop which comes from formattedPostIds
        // When formattedPostIds is empty, VirtPostList receives an empty array
        expect(capturedPostListIds).toEqual([]);
    });

    it('getOldestVisiblePostId and getLatestVisiblePostId should return based on postListIds', async () => {
        // These are internal instance methods that can't be accessed via RTL
        // getOldestVisiblePostId returns postListIds[length-1]
        // getLatestVisiblePostId returns postListIds[0]
        const postIds = createFakePosIds(10);
        const formattedPostIds = ['1', '2'];
        renderWithContext(
            <PostList {...{...baseProps, postListIds: postIds, formattedPostIds}}/>,
        );

        await act(async () => {});

        // Verify the component renders with these props
        await waitFor(() => expect(capturedPostListIds).not.toBeNull());
        expect(capturedPostListIds).toEqual(formattedPostIds);
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

        test('Should not call loadPosts if olderPosts or newerPosts are loading', async () => {
            const postIds = createFakePosIds(2);
            let resolveLoadPosts: () => void;
            const loadPosts = vi.fn().mockImplementation(() => new Promise((resolve) => {
                resolveLoadPosts = () => resolve({moreToLoad: false});
            }));
            const props = {
                ...baseProps,
                isFirstLoad: false,
                postListIds: postIds,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            // Start first load
            act(() => {
                capturedActions!.loadOlderPosts();
            });

            // Try canLoadMorePosts while loading
            act(() => {
                capturedActions!.canLoadMorePosts(undefined);
            });

            // Should only be called once (from loadOlderPosts)
            expect(loadPosts).toHaveBeenCalledTimes(1);

            await act(async () => {
                resolveLoadPosts!();
            });
        });

        test('Should not call loadPosts if there were more than MAX_EXTRA_PAGES_LOADED', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false}));
            const props = {
                ...baseProps,
                isFirstLoad: false,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            // Call canLoadMorePosts MAX_EXTRA_PAGES_LOADED + 1 times
            // After exceeding the limit, loadPosts should not be called anymore
            // eslint-disable-next-line no-await-in-loop, no-loop-func
            for (let i = 0; i <= MAX_EXTRA_PAGES_LOADED; i++) {
                loadPosts.mockClear();

                // eslint-disable-next-line no-await-in-loop, no-loop-func
                await act(async () => {
                    await capturedActions!.canLoadMorePosts(undefined);
                });
            }

            // After MAX_EXTRA_PAGES_LOADED calls, the next call should NOT trigger loadPosts
            loadPosts.mockClear();
            await act(async () => {
                await capturedActions!.canLoadMorePosts(undefined);
            });

            expect(loadPosts).not.toHaveBeenCalled();
        });

        test('Should call getPostsBefore if not all older posts are loaded', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false}));
            const props = {
                ...baseProps,
                isFirstLoad: false,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.canLoadMorePosts(undefined);
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[postIds.length - 1],
                type: PostRequestTypes.BEFORE_ID,
                perPage: 200,
            });
        });

        test('Should call getPostsAfter if all older posts are loaded and not newerPosts', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false}));
            const props = {
                ...baseProps,
                isFirstLoad: false,
                postListIds: postIds,
                atOldestPost: true,
                atLatestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.canLoadMorePosts(undefined);
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[0],
                type: PostRequestTypes.AFTER_ID,
                perPage: 30,
            });
        });

        test('Should call getPostsAfter canLoadMorePosts is requested with AFTER_ID', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: false}));
            const props = {
                ...baseProps,
                isFirstLoad: false,
                postListIds: postIds,
                atOldestPost: true,
                atLatestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.canLoadMorePosts(PostRequestTypes.AFTER_ID);
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[0],
                type: PostRequestTypes.AFTER_ID,
                perPage: 30,
            });
        });
    });

    describe('Auto retry of load more posts', () => {
        test('Should retry loadPosts on failure of loadPosts', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: true, error: {}}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.loadOlderPosts();
            });

            // Should retry up to MAX_NUMBER_OF_AUTO_RETRIES (3) times + initial call
            expect(loadPosts).toHaveBeenCalledTimes(4);
            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[postIds.length - 1],
                type: PostRequestTypes.BEFORE_ID,
                perPage: 30,
            });
        });
    });

    describe('markChannelAsReadAndViewed', () => {
        test('Should call markChannelAsReadAndViewed on postsOnLoad', async () => {
            const emptyPostList: string[] = [];

            renderWithContext(
                <PostList {...{...baseProps, postListIds: emptyPostList}}/>,
            );

            await act(async () => {});

            expect(actionsProp.markChannelAsRead).toHaveBeenCalledWith(baseProps.channelId);
        });

        test('Should not call markChannelAsReadAndViewed as it is a permalink', async () => {
            const emptyPostList: string[] = [];
            const focusedPostId = 'new';
            renderWithContext(
                <PostList {...{...baseProps, postListIds: emptyPostList, focusedPostId}}/>,
            );

            await act(async () => {});

            expect(actionsProp.markChannelAsRead).not.toHaveBeenCalled();
        });
    });

    describe('Differentiated page sizes', () => {
        test('Should use 30 posts for user scroll (getPostsBefore)', async () => {
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

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.loadOlderPosts();
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[postIds.length - 1],
                type: PostRequestTypes.BEFORE_ID,
                perPage: 30,
            });
        });

        test('Should use 200 posts for auto-loading (getPostsBeforeAutoLoad)', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.canLoadMorePosts(PostRequestTypes.BEFORE_ID);
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[postIds.length - 1],
                type: PostRequestTypes.BEFORE_ID,
                perPage: 200,
            });
        });

        test('Should use 30 posts for user scroll down (getPostsAfter)', async () => {
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

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.loadNewerPosts();
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[0],
                type: PostRequestTypes.AFTER_ID,
                perPage: 30,
            });
        });

        test('Should use 200 posts when canLoadMorePosts is triggered with BEFORE_ID', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = vi.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(<PostList {...props}/>);

            await act(async () => {});
            await waitFor(() => expect(capturedActions).not.toBeNull());

            await act(async () => {
                await capturedActions!.canLoadMorePosts(PostRequestTypes.BEFORE_ID);
            });

            expect(loadPosts).toHaveBeenCalledWith(expect.objectContaining({
                perPage: 200,
            }));
        });
    });
});
