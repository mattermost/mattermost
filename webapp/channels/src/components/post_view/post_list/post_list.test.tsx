// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import VirtPostList from 'components/post_view/post_list_virtualized/post_list_virtualized';

import {PostRequestTypes} from 'utils/constants';

import PostList, {MAX_EXTRA_PAGES_LOADED} from './post_list';

const actionsProp = {
    loadPostsAround: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadUnreads: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    loadPosts: jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: false})),
    syncPostsInChannel: jest.fn().mockResolvedValue({}),
    loadLatestPosts: jest.fn().mockImplementation(() => Promise.resolve({atLatestMessage: true, atOldestmessage: true})),
    checkAndSetMobileView: jest.fn(),
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
};

describe('components/post_view/post_list', () => {
    it('snapshot for loading when there are no posts', () => {
        const wrapper = shallow(
            <PostList {...{...baseProps, postListIds: []}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('snapshot with couple of posts', () => {
        const postIds = createFakePosIds(2);
        const wrapper = shallow(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('Should call postsOnLoad', async () => {
        const emptyPostList: string[] = [];

        const wrapper = shallow<PostList>(
            <PostList {...{...baseProps, postListIds: emptyPostList}}/>,
        );

        expect(actionsProp.loadUnreads).toHaveBeenCalledWith(baseProps.channelId);
        await wrapper.instance().postsOnLoad('undefined');
        expect(wrapper.state('loadingNewerPosts')).toBe(false);
        expect(wrapper.state('loadingOlderPosts')).toBe(false);
    });

    it('Should not call loadUnreads if isPrefetchingInProcess is true', async () => {
        const emptyPostList: string[] = [];

        shallow(<PostList {...{...baseProps, postListIds: emptyPostList, isPrefetchingInProcess: true}}/>);

        expect(actionsProp.loadUnreads).not.toHaveBeenCalledWith(baseProps.channelId);
    });

    it('Should call for before and afterPosts', async () => {
        const postIds = createFakePosIds(2);
        const wrapper = shallow<PostList>(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );

        wrapper.find(VirtPostList).prop('actions').loadOlderPosts();
        expect(wrapper.state('loadingOlderPosts')).toEqual(true);
        expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID});
        await wrapper.instance().callLoadPosts('undefined', 'undefined', undefined);
        expect(wrapper.state('loadingOlderPosts')).toBe(false);

        wrapper.find(VirtPostList).prop('actions').loadNewerPosts();
        expect(wrapper.state('loadingNewerPosts')).toEqual(true);
        expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID});
        await wrapper.instance().callLoadPosts('undefined', 'undefined', undefined);
        expect(wrapper.state('loadingNewerPosts')).toBe(false);
    });

    it('VirtPostList Should have formattedPostIds as prop', async () => {
        const postIds = createFakePosIds(2);
        const wrapper = shallow(
            <PostList {...{...baseProps, postListIds: postIds}}/>,
        );

        const formattedPostIds = wrapper.find(VirtPostList).prop('postListIds');
        expect(formattedPostIds).toEqual([]);
    });

    it('getOldestVisiblePostId and getLatestVisiblePostId should return based on postListIds', async () => {
        const postIds = createFakePosIds(10);
        const formattedPostIds = ['1', '2'];
        const wrapper = shallow<PostList>(
            <PostList {...{...baseProps, postListIds: postIds, formattedPostIds}}/>,
        );

        const instance = wrapper.instance();
        expect(instance.getOldestVisiblePostId()).toEqual('123410');
        expect(instance.getLatestVisiblePostId()).toEqual('12341');
    });

    it('Should call for permalink posts', async () => {
        const focusedPostId = 'new';
        const wrapper = shallow(
            <PostList {...{...baseProps, focusedPostId}}/>,
        );

        expect(actionsProp.loadPostsAround).toHaveBeenCalledWith(baseProps.channelId, focusedPostId);
        await actionsProp.loadPostsAround();
        expect(wrapper.state('loadingOlderPosts')).toBe(false);
        expect(wrapper.state('loadingNewerPosts')).toBe(false);
    });

    it('Should call for loadLatestPosts', async () => {
        const wrapper = shallow(
            <PostList {...{...baseProps, postListIds: [], isFirstLoad: false}}/>,
        );

        expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
        await actionsProp.loadLatestPosts();
        expect(wrapper.state('loadingOlderPosts')).toBe(false);
        expect(wrapper.state('loadingNewerPosts')).toBe(false);
    });

    describe('getPostsSince', () => {
        test('should call getPostsSince on channel switch', () => {
            const postIds = createFakePosIds(2);
            shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds, latestPostTimeStamp: 1234}}/>);
            expect(actionsProp.syncPostsInChannel).toHaveBeenCalledWith(baseProps.channelId, 1234, false);
        });
    });

    describe('canLoadMorePosts', () => {
        test('Should not call loadLatestPosts if postListIds is empty', async () => {
            const wrapper = shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: []}}/>);
            expect(actionsProp.loadLatestPosts).toHaveBeenCalledWith(baseProps.channelId);
            await actionsProp.loadLatestPosts();
            expect(wrapper.state('loadingOlderPosts')).toBe(false);
            expect(wrapper.state('loadingNewerPosts')).toBe(false);
        });

        test('Should not call loadPosts if olderPosts or newerPosts are loading', async () => {
            const postIds = createFakePosIds(2);
            const wrapper = shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds}}/>);
            wrapper.setState({loadingOlderPosts: true});
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(undefined);
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
            wrapper.setState({loadingOlderPosts: false});
            wrapper.setState({loadingNewerPosts: true});
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(undefined);
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
        });

        test('Should not call loadPosts if there were more than MAX_EXTRA_PAGES_LOADED', async () => {
            const postIds = createFakePosIds(2);
            const wrapper = shallow<PostList>(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds}}/>);
            wrapper.instance().extraPagesLoaded = MAX_EXTRA_PAGES_LOADED + 1;
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(undefined);
            expect(actionsProp.loadPosts).not.toHaveBeenCalled();
        });

        test('Should call getPostsBefore if not all older posts are loaded', async () => {
            const postIds = createFakePosIds(2);
            const wrapper = shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds}}/>);
            wrapper.setProps({atOldestPost: false});
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(undefined);
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID});
        });

        test('Should call getPostsAfter if all older posts are loaded and not newerPosts', async () => {
            const postIds = createFakePosIds(2);
            const wrapper = shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds}}/>);
            wrapper.setProps({atOldestPost: true});
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(undefined);
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID});
        });

        test('Should call getPostsAfter canLoadMorePosts is requested with AFTER_ID', async () => {
            const postIds = createFakePosIds(2);
            const wrapper = shallow(<PostList {...{...baseProps, isFirstLoad: false, postListIds: postIds}}/>);
            wrapper.find(VirtPostList).prop('actions').canLoadMorePosts(PostRequestTypes.AFTER_ID);
            expect(actionsProp.loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[0], type: PostRequestTypes.AFTER_ID});
        });
    });

    describe('Auto retry of load more posts', () => {
        test('Should retry loadPosts on failure of loadPosts', async () => {
            const postIds = createFakePosIds(2);
            const loadPosts = jest.fn().mockImplementation(() => Promise.resolve({moreToLoad: true, error: {}}));
            const props = {
                ...baseProps,
                postListIds: postIds,
                actions: {
                    ...actionsProp,
                    loadPosts,
                },
            };

            const wrapper = shallow(
                <PostList {...props}/>,
            );

            wrapper.find(VirtPostList).prop('actions').loadOlderPosts();
            expect(wrapper.state('loadingOlderPosts')).toEqual(true);
            expect(loadPosts).toHaveBeenCalledTimes(1);
            expect(loadPosts).toHaveBeenCalledWith({channelId: baseProps.channelId, postId: postIds[postIds.length - 1], type: PostRequestTypes.BEFORE_ID});
            await loadPosts();
            expect(wrapper.state('loadingOlderPosts')).toBe(false);
            expect(loadPosts).toHaveBeenCalledTimes(3);
        });
    });

    describe('markChannelAsReadAndViewed', () => {
        test('Should call markChannelAsReadAndViewed on postsOnLoad', async () => {
            const emptyPostList: string[] = [];

            const wrapper = shallow<PostList>(
                <PostList {...{...baseProps, postListIds: emptyPostList}}/>,
            );

            await wrapper.instance().postsOnLoad('undefined');
            expect(actionsProp.markChannelAsRead).toHaveBeenCalledWith(baseProps.channelId);
        });
        test('Should not call markChannelAsReadAndViewed as it is a permalink', async () => {
            const emptyPostList: string[] = [];
            const focusedPostId = 'new';
            shallow(
                <PostList {...{...baseProps, postListIds: emptyPostList, focusedPostId}}/>,
            );

            await actionsProp.loadPostsAround();
            expect(actionsProp.markChannelAsRead).not.toHaveBeenCalled();
        });
    });
});
