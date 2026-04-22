// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, act, runPostRenderAct} from 'tests/react_testing_utils';
import {PostRequestTypes} from 'utils/constants';

import PostList, {MAX_EXTRA_PAGES_LOADED} from './post_list';

let lastVirtPostListProps: any = null;
jest.mock('components/post_view/post_list_virtualized/post_list_virtualized', () => ({
    __esModule: true,
    default: (props: any) => {
        lastVirtPostListProps = props;
        return <div data-testid='virt-post-list'/>;
    },
}));

jest.mock('components/loading_screen', () => ({
    __esModule: true,
    default: ({centered}: {centered?: boolean}) => (
        <div
            data-testid='loading-screen'
            data-centered={centered}
        >{'Loading'}</div>
    ),
}));

jest.mock('actions/telemetry_actions.jsx', () => ({
    clearMarks: jest.fn(),
    mark: jest.fn(),
}));

jest.mock('utils/performance_telemetry', () => ({
    Mark: {},
    Measure: {},
    measureAndReport: jest.fn(),
}));

const actionsProp = {
    loadPostsAround: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadUnreads: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadPosts: jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: false})),
    syncPostsInChannel: jest.fn().mockResolvedValue({}),
    loadLatestPosts: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    markChannelAsRead: jest.fn(),
    updateNewMessagesAtInChannel: jest.fn(),
    toggleShouldStartFromBottomWhenUnread: jest.fn(),
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
    changeUnreadChunkTimeStamp: jest.fn(),
    toggleShouldStartFromBottomWhenUnread: jest.fn(),
    isFirstLoad: true,
    atLatestPost: false,
    formattedPostIds: [],
    isPrefetchingInProcess: false,
    isMobileView: false,
    hasInaccessiblePosts: false,
    shouldStartFromBottomWhenUnread: false,
    isChannelAutotranslated: false,
};

describe('components/post_view/post_list', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        lastVirtPostListProps = null;
    });

    it('snapshot for loading when there are no posts', () => {
        const {container} = renderWithContext(
            <PostList {...{...baseProps, postListIds: []}}/>,
        );
        expect(container).toMatchSnapshot();
    });

    it('snapshot with couple of posts', () => {
        const postIds = createFakePosIds(2);
        const {container} = renderWithContext(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );
        expect(container).toMatchSnapshot();
    });

    it('Should call postsOnLoad', async () => {
        const emptyPostList: string[] = [];

        const ref = React.createRef<PostList>();
        renderWithContext(
            <PostList
                ref={ref}
                {...{...baseProps, postListIds: emptyPostList}}
            />,
        );

        expect(actionsProp.loadUnreads).toHaveBeenCalledWith(baseProps.channelId);
        await act(async () => {
            await ref.current!.postsOnLoad('undefined');
        });
        expect(ref.current!.state.loadingNewerPosts).toBe(false);
        expect(ref.current!.state.loadingOlderPosts).toBe(false);
    });

    it('Should not call loadUnreads if isPrefetchingInProcess is true', async () => {
        const emptyPostList: string[] = [];

        renderWithContext(
            <PostList
                {...{...baseProps, postListIds: emptyPostList, isPrefetchingInProcess: true}}
            />,
        );

        expect(actionsProp.loadUnreads).not.toHaveBeenCalledWith(baseProps.channelId);
    });

    it('Should call for before and afterPosts', async () => {
        const postIds = createFakePosIds(2);
        const ref = React.createRef<PostList>();

        renderWithContext(
            <PostList
                ref={ref}
                {...{...baseProps, postListIds: postIds}}
            />,
        );

        await runPostRenderAct();

        // Use deferred promise to capture intermediate loading state
        let resolveOlderLoadPosts!: (value: any) => void;
        actionsProp.loadPosts.mockImplementationOnce(() => new Promise((resolve) => {
            resolveOlderLoadPosts = resolve;
        }));

        await act(async () => {
            lastVirtPostListProps.actions.loadOlderPosts();
        });
        expect(ref.current!.state.loadingOlderPosts).toEqual(true);
        expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID, perPage: 30});
        await act(async () => {
            resolveOlderLoadPosts({moreToLoad: false});
        });
        expect(ref.current!.state.loadingOlderPosts).toBe(false);

        let resolveNewerLoadPosts!: (value: any) => void;
        actionsProp.loadPosts.mockImplementationOnce(() => new Promise((resolve) => {
            resolveNewerLoadPosts = resolve;
        }));

        await act(async () => {
            lastVirtPostListProps.actions.loadNewerPosts();
        });
        expect(ref.current!.state.loadingNewerPosts).toEqual(true);
        expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID, perPage: 30});
        await act(async () => {
            resolveNewerLoadPosts({moreToLoad: false});
        });
        expect(ref.current!.state.loadingNewerPosts).toBe(false);
    });

    it('VirtPostList Should have formattedPostIds as prop', async () => {
        const postIds = createFakePosIds(2);
        renderWithContext(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );

        expect(lastVirtPostListProps.postListIds).toEqual([]);
    });

    it('getOldestVisiblePostId and getLatestVisiblePostId should return based on postListIds', async () => {
        const postIds = createFakePosIds(10);
        const formattedPostIds = ['1', '2'];
        const ref = React.createRef<PostList>();
        renderWithContext(
            <PostList
                ref={ref}
                {...{...baseProps, postListIds: postIds, formattedPostIds}}
            />,
        );

        expect(ref.current!.getOldestVisiblePostId()).toEqual('123410');
        expect(ref.current!.getLatestVisiblePostId()).toEqual('12341');
    });

    it('Should call for permalink posts', async () => {
        const focusedPostId = 'new';
        const ref = React.createRef<PostList>();
        renderWithContext(
            <PostList
                ref={ref}
                {...{...baseProps, focusedPostId}}
            />,
        );

        expect(actionsProp.loadPostsAround).toHaveBeenCalledWith(baseProps.channelId, focusedPostId);
        await act(async () => {
            await actionsProp.loadPostsAround();
        });
        expect(ref.current!.state.loadingOlderPosts).toBe(false);
        expect(ref.current!.state.loadingNewerPosts).toBe(false);
    });

    it('Should call for loadLatestPosts', async () => {
        const ref = React.createRef<PostList>();
        renderWithContext(
            <PostList
                ref={ref}
                {...{...baseProps, postListIds: [], isFirstLoad: false}}
            />,
        );

        expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
        await act(async () => {
            await actionsProp.loadLatestPosts();
        });
        expect(ref.current!.state.loadingOlderPosts).toBe(false);
        expect(ref.current!.state.loadingNewerPosts).toBe(false);
    });

    describe('getPostsSince', () => {
        test('should call getPostsSince on channel switch', async () => {
            const postIds = createFakePosIds(2);
            renderWithContext(
                <PostList
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds, latestPostTimeStamp: 1234}}
                />,
            );
            expect(actionsProp.syncPostsInChannel).toHaveBeenCalledWith(baseProps.channelId, 1234, false);
        });
    });

    describe('canLoadMorePosts', () => {
        test('Should not call loadLatestPosts if postListIds is empty', async () => {
            const ref = React.createRef<PostList>();
            renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: []}}
                />,
            );
            expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
            await act(async () => {
                await actionsProp.loadLatestPosts();
            });
            expect(ref.current!.state.loadingOlderPosts).toBe(false);
            expect(ref.current!.state.loadingNewerPosts).toBe(false);
        });

        test('Should not call loadPosts if olderPosts or newerPosts are loading', async () => {
            const postIds = createFakePosIds(2);
            const ref = React.createRef<PostList>();
            renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds}}
                />,
            );
            act(() => {
                ref.current!.setState({loadingOlderPosts: true});
            });
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(undefined);
            });
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
            act(() => {
                ref.current!.setState({loadingOlderPosts: false});
            });
            act(() => {
                ref.current!.setState({loadingNewerPosts: true});
            });
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(undefined);
            });
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
        });

        test('Should not call loadPosts if there were more than MAX_EXTRA_PAGES_LOADED', async () => {
            const postIds = createFakePosIds(2);
            const ref = React.createRef<PostList>();
            renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds}}
                />,
            );
            ref.current!.extraPagesLoaded = MAX_EXTRA_PAGES_LOADED + 1;
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(undefined);
            });
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
        });

        test('Should call getPostsBefore if not all older posts are loaded', async () => {
            const postIds = createFakePosIds(2);
            const ref = React.createRef<PostList>();
            const {rerender} = renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds}}
                />,
            );
            await act(async () => {});
            rerender(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds, atOldestPost: false}}
                />,
            );
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(undefined);
            });
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID, perPage: 200});
        });

        test('Should call getPostsAfter if all older posts are loaded and not newerPosts', async () => {
            const postIds = createFakePosIds(2);
            const ref = React.createRef<PostList>();
            const {rerender} = renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds}}
                />,
            );
            await act(async () => {});
            rerender(
                <PostList
                    ref={ref}
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds, atOldestPost: true}}
                />,
            );
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(undefined);
            });
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID, perPage: 30});
        });

        test('Should call getPostsAfter canLoadMorePosts is requested with AFTER_ID', async () => {
            const postIds = createFakePosIds(2);
            renderWithContext(
                <PostList
                    {...{...baseProps, isFirstLoad: false, postListIds: postIds}}
                />,
            );
            await act(async () => {
                lastVirtPostListProps.actions.canLoadMorePosts(PostRequestTypes.AFTER_ID);
            });
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID, perPage: 30});
        });
    });

    describe('Auto retry of load more posts', () => {
        test('Should retry loadPosts on failure of loadPosts', async () => {
            const postIds = createFakePosIds(2);

            // Use deferred first call to capture intermediate loading state
            let resolveFirstCall!: (value: any) => void;
            const loadPosts = jest.fn().
                mockImplementationOnce(() => new Promise((resolve) => {
                    resolveFirstCall = resolve;
                })).
                mockImplementation(() => Promise.resolve({moreToLoad: true, error: {}}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            const ref = React.createRef<PostList>();
            renderWithContext(
                <PostList
                    ref={ref}
                    {...props}
                />,
            );

            await runPostRenderAct();

            await act(async () => {
                lastVirtPostListProps.actions.loadOlderPosts();
            });
            expect(ref.current!.state.loadingOlderPosts).toEqual(true);
            expect(loadPosts).toHaveBeenCalledTimes(1);
            expect(loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID, perPage: 30});

            // Resolve first call with error to trigger retries
            await act(async () => {
                resolveFirstCall({moreToLoad: true, error: {}});
            });
            expect(ref.current!.state.loadingOlderPosts).toBe(false);

            // 1 original + 3 retries = 4 total calls
            expect(loadPosts).toHaveBeenCalledTimes(4);
        });
    });

    describe('markChannelAsReadAndViewed', () => {
        test('Should call markChannelAsReadAndViewed on postsOnLoad', async () => {
            const emptyPostList: string[] = [];

            const ref = React.createRef<PostList>();
            renderWithContext(
                <PostList
                    ref={ref}
                    {...{...baseProps, postListIds: emptyPostList}}
                />,
            );

            await act(async () => {
                await ref.current!.postsOnLoad('undefined');
            });
            expect(actionsProp.markChannelAsRead).toHaveBeenCalledWith(baseProps.channelId);
        });
        test('Should not call markChannelAsReadAndViewed as it is a permalink', async () => {
            const emptyPostList: string[] = [];
            const focusedPostId = 'new';
            renderWithContext(
                <PostList
                    {...{...baseProps, postListIds: emptyPostList, focusedPostId}}
                />,
            );

            await act(async () => {
                await actionsProp.loadPostsAround();
            });
            expect(actionsProp.markChannelAsRead).not.toHaveBeenCalled();
        });
    });

    describe('Differentiated page sizes', () => {
        test('Should use 30 posts for user scroll (getPostsBefore)', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
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

            // Trigger user scroll up (async setState + loadPosts; wrap in act, not render)
            await act(async () => {
                await lastVirtPostListProps.actions.loadOlderPosts();
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
            const loadPosts = jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(
                <PostList {...props}/>,
            );

            // Trigger auto-loading via canLoadMorePosts
            await act(async () => {
                await lastVirtPostListProps.actions.canLoadMorePosts(PostRequestTypes.BEFORE_ID);
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[postIds.length - 1],
                type: PostRequestTypes.BEFORE_ID,
                perPage: 200, // AUTO_LOAD_POSTS_PER_PAGE
            });
        });

        test('Should use 30 posts for user scroll down (getPostsAfter)', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
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

            await act(async () => {
                await lastVirtPostListProps.actions.loadNewerPosts();
            });

            expect(loadPosts).toHaveBeenCalledWith({
                channelId: baseProps.channelId,
                postId: postIds[0],
                type: PostRequestTypes.AFTER_ID,
                perPage: 30, // USER_SCROLL_POSTS_PER_PAGE
            });
        });

        test('Should use 200 posts when canLoadMorePosts is triggered with BEFORE_ID', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: true}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                atOldestPost: false,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            renderWithContext(
                <PostList {...props}/>,
            );

            await act(async () => {
                await lastVirtPostListProps.actions.canLoadMorePosts(PostRequestTypes.BEFORE_ID);
            });

            // Should use auto-load page size (200 posts)
            expect(loadPosts).toHaveBeenCalledWith(expect.objectContaining({
                perPage: 200,
            }));
        });
    });
});
