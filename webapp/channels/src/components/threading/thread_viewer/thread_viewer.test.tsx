// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, waitFor} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {TestHelper} from 'utils/test_helper';

import type {FakePost} from 'types/store/rhs';

import ThreadViewer from './thread_viewer';
import type {Props} from './thread_viewer';

jest.mock('components/deferComponentRender', () => (component: any) => component);

jest.mock('../virtualized_thread_viewer', () => () => (
    <div data-testid='virtualized-thread-viewer'/>
));

jest.mock('components/file_upload_overlay', () => () => (
    <div data-testid='file-upload-overlay'/>
));

jest.mock('client/web_websocket_client', () => ({
    __esModule: true,
    default: {
        updateActiveThread: jest.fn(),
    },
}));

describe('components/threading/ThreadViewer', () => {
    const post: Post = TestHelper.getPostMock({
        channel_id: 'channel_id',
        create_at: 1502715365009,
        update_at: 1502715372443,
        is_following: true,
        reply_count: 3,
    });

    const fakePost: FakePost = {
        id: post.id,
        exists: true,
        type: post.type,
        user_id: post.user_id,
        channel_id: post.channel_id,
        message: post.message,
        reply_count: 3,
    };

    const channel: Channel = TestHelper.getChannelMock({
        display_name: '',
        name: '',
        header: '',
        purpose: '',
        creator_id: '',
        scheme_id: '',
        teammate_id: '',
        status: '',
    });

    const actions = {
        removePost: jest.fn(),
        selectPostCard: jest.fn(),
        getNewestPostThread: jest.fn(),
        getPostThread: jest.fn(),
        getThread: jest.fn(),
        updateThreadRead: jest.fn(),
        updateThreadLastOpened: jest.fn(),
        updateThreadLastUpdateAt: jest.fn(),
        fetchRHSAppsBindings: jest.fn(),
    };

    const baseProps: Props = {
        selected: post,
        channel,
        currentUserId: 'user_id',
        currentTeamId: 'team_id',
        socketConnectionStatus: true,
        actions,
        isCollapsedThreadsEnabled: false,
        postIds: [post.id],
        appsEnabled: true,
        rootPostId: post.id,
        isThreadView: true,
        enableWebSocketEventScope: false,
        lastUpdateAt: 1234,
    };

    beforeEach(() => {
        // Reset and redefine the mock before each test
        actions.getPostThread.mockReset().mockResolvedValue({
            data: {
                order: ['post1', 'post2', 'post3'],
                posts: {
                    post1: TestHelper.getPostMock({id: 'post1', update_at: 1000}),
                    post2: TestHelper.getPostMock({id: 'post2', update_at: 2000}),
                    post3: TestHelper.getPostMock({id: 'post3', update_at: 1500}),
                },
            },
        });
    });

    test('should match snapshot', async () => {
        const reset = fakeDate(new Date(1502715365000));

        const {container} = render(
            <ThreadViewer {...baseProps}/>,
        );

        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
        reset();
    });

    test('should make api call to get thread posts on socket reconnect', async () => {
        const {rerender} = render(
            <ThreadViewer {...baseProps}/>,
        );

        // ThreadViewer calls getPostThread(rootId, !reconnected, lastUpdateAt) from onInit(reconnected).
        // Initial mount: onInit(false) → fetchThreads true. After reconnect: onInit(true) → fetchThreads false.
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalledWith(post.id, true, 1234);
        });
        actions.getPostThread.mockClear();

        rerender(
            <ThreadViewer
                {...baseProps}
                socketConnectionStatus={false}
            />,
        );
        rerender(
            <ThreadViewer
                {...baseProps}
                socketConnectionStatus={true}
            />,
        );

        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalledTimes(1);
            expect(actions.getPostThread).toHaveBeenCalledWith(post.id, false, 1234);
        });
    });

    test('should not break if root post is a fake post', () => {
        const props = {
            ...baseProps,
            selected: fakePost,
        };

        expect(() => {
            render(<ThreadViewer {...props}/>);
        }).not.toThrow("Cannot read property 'reply_count' of undefined");
    });

    test('should not break if root post is ID only', () => {
        const props = {
            ...baseProps,
            rootPostId: post.id,
            selected: undefined,
        };

        expect(() => {
            render(<ThreadViewer {...props}/>);
        }).not.toThrow("Cannot read property 'reply_count' of undefined");
    });

    test('should call fetchThread when no thread on mount', async () => {
        const {actions} = baseProps;

        render(
            <ThreadViewer
                {...baseProps}
                isCollapsedThreadsEnabled={true}
            />,
        );

        await waitFor(() => {
            expect(actions.getThread).toHaveBeenCalledWith('user_id', 'team_id', 'id', true);
        });
        expect(actions.updateThreadLastOpened).not.toHaveBeenCalled();
        expect(actions.updateThreadRead).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened on mount', () => {
        jest.useFakeTimers().setSystemTime(400);
        const {actions} = baseProps;
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 32,
        } as UserThread;

        render(
            <ThreadViewer
                {...baseProps}
                userThread={userThread}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).not.toHaveBeenCalled();
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead on mount when unread replies', () => {
        jest.useFakeTimers().setSystemTime(400);
        const {actions} = baseProps;
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        render(
            <ThreadViewer
                {...baseProps}
                userThread={userThread}
                isCollapsedThreadsEnabled={true}
            />,
        );

        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).toHaveBeenCalledWith('user_id', 'team_id', 'id', 400);
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead upon thread id change', async () => {
        jest.useRealTimers();
        const dateNowOrig = Date.now;
        Date.now = () => new Date(400).getMilliseconds();
        const {actions} = baseProps;

        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        const {rerender} = render(
            <ThreadViewer
                {...baseProps}
                isCollapsedThreadsEnabled={true}
            />,
        );

        await waitFor(() => {
            expect(actions.getThread).toHaveBeenCalled();
        });
        expect(actions.updateThreadLastOpened).not.toHaveBeenCalled();
        expect(actions.updateThreadRead).not.toHaveBeenCalled();

        jest.resetAllMocks();
        jest.mocked(baseProps.actions.getPostThread).mockResolvedValue({
            data: {
                order: ['post1', 'post2', 'post3'],
                posts: {
                    post1: TestHelper.getPostMock({id: 'post1', update_at: 1000}),
                    post2: TestHelper.getPostMock({id: 'post2', update_at: 2000}),
                    post3: TestHelper.getPostMock({id: 'post3', update_at: 1500}),
                },
            },
        });
        rerender(
            <ThreadViewer
                {...baseProps}
                isCollapsedThreadsEnabled={true}
                userThread={userThread}
            />,
        );

        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).toHaveBeenCalledWith('user_id', 'team_id', 'id', 400);
        expect(actions.getThread).not.toHaveBeenCalled();
        Date.now = dateNowOrig;
    });

    test('should call fetchRHSAppsBindings on mount if appsEnabled', () => {
        const {actions} = baseProps;

        render(
            <ThreadViewer
                {...baseProps}
            />,
        );

        expect(actions.fetchRHSAppsBindings).toHaveBeenCalledWith('channel_id', 'id');
    });

    test('should not call fetchRHSAppsBindings on mount if not appsEnabled', () => {
        const {actions} = baseProps;

        render(
            <ThreadViewer
                {...baseProps}
                appsEnabled={false}
            />,
        );

        expect(actions.fetchRHSAppsBindings).not.toHaveBeenCalledWith('channel_id', 'id');
    });

    test('should update thread with highest update_at value when lastUpdateAt is 0', async () => {
        const {actions} = baseProps;

        render(
            <ThreadViewer
                {...baseProps}
                lastUpdateAt={0} // Set lastUpdateAt to 0
            />,
        );

        await waitFor(() => {
            // Verify getPostThread was called with lastUpdateAt = 0
            expect(actions.getPostThread).toHaveBeenCalledWith(post.id, true, 0);
        });

        // Verify updateThreadLastUpdateAt was called with the highest update_at value
        expect(actions.updateThreadLastUpdateAt).toHaveBeenCalledWith(post.id, 2000);
    });

    test('should handle case where root post has the highest update_at value', async () => {
        // Mock with root post having highest update_at
        actions.getPostThread.mockReset().mockResolvedValue({
            data: {
                order: ['post1', 'post2', 'post3'],
                posts: {
                    post1: TestHelper.getPostMock({id: 'post1', update_at: 9000}), // Highest value (root post)
                    post2: TestHelper.getPostMock({id: 'post2', update_at: 2000}),
                    post3: TestHelper.getPostMock({id: 'post3', update_at: 1500}),
                },
            },
        });

        render(
            <ThreadViewer
                {...baseProps}
            />,
        );

        await waitFor(() => {
            // Verify updateThreadLastUpdateAt was called with the highest update_at value
            expect(actions.updateThreadLastUpdateAt).toHaveBeenCalledWith(post.id, 9000);
        });
    });
});
