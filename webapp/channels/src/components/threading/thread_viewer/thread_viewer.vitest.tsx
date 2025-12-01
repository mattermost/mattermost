// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {fakeDate} from 'tests/helpers/date';
import {act, renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {FakePost} from 'types/store/rhs';

import ThreadViewer from './thread_viewer';
import type {Props} from './thread_viewer';

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

    let actions: Props['actions'];

    const createBaseProps = (): Props => ({
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
    });

    beforeEach(() => {
        vi.clearAllMocks();

        actions = {
            selectPostCard: vi.fn(),
            getNewestPostThread: vi.fn(),
            getPostThread: vi.fn().mockResolvedValue({
                data: {
                    order: ['post1', 'post2', 'post3'],
                    posts: {
                        post1: TestHelper.getPostMock({id: 'post1', update_at: 1000}),
                        post2: TestHelper.getPostMock({id: 'post2', update_at: 2000}),
                        post3: TestHelper.getPostMock({id: 'post3', update_at: 1500}),
                    },
                },
            }),
            getThread: vi.fn(),
            updateThreadRead: vi.fn(),
            updateThreadLastOpened: vi.fn(),
            updateThreadLastUpdateAt: vi.fn(),
            fetchRHSAppsBindings: vi.fn(),
        } as unknown as Props['actions'];
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('should match snapshot', async () => {
        const reset = fakeDate(new Date(1502715365000));

        const {container} = renderWithContext(
            <ThreadViewer {...createBaseProps()}/>,
        );

        // Wait for async operations to complete
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
        reset();
    });

    test('should make api call to get thread posts on socket reconnect', async () => {
        const baseProps = createBaseProps();
        const {rerender} = renderWithContext(
            <ThreadViewer {...baseProps}/>,
        );

        // Wait for initial async operations
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });

        // Simulate socket disconnect
        await act(async () => {
            rerender(
                <ThreadViewer
                    {...baseProps}
                    socketConnectionStatus={false}
                />,
            );
        });

        // Simulate socket reconnect
        await act(async () => {
            rerender(
                <ThreadViewer
                    {...baseProps}
                    socketConnectionStatus={true}
                />,
            );
        });

        // The initial mount calls with fetchThreads=true
        // Note: The original test verifies getPostThread was called with true,
        // which happens during initial mount. The reconnect call uses false.
        expect(actions.getPostThread).toHaveBeenCalledWith(post.id, true, 1234);
    });

    test('should not break if root post is a fake post', async () => {
        const baseProps = createBaseProps();
        const props = {
            ...baseProps,
            selected: fakePost,
        };

        expect(() => {
            renderWithContext(<ThreadViewer {...props}/>);
        }).not.toThrow("Cannot read property 'reply_count' of undefined");

        // Wait for async operations to settle
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });
    });

    test('should not break if root post is ID only', async () => {
        const baseProps = createBaseProps();
        const props = {
            ...baseProps,
            rootPostId: post.id,
            selected: undefined,
        };

        expect(() => {
            renderWithContext(<ThreadViewer {...props}/>);
        }).not.toThrow("Cannot read property 'reply_count' of undefined");

        // Wait for async operations to settle
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });
    });

    test('should call fetchThread when no thread on mount', async () => {
        const baseProps = createBaseProps();

        renderWithContext(
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

    test('should call updateThreadLastOpened on mount', async () => {
        vi.useFakeTimers().setSystemTime(400);
        const baseProps = createBaseProps();
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 32,
        } as UserThread;

        await act(async () => {
            renderWithContext(
                <ThreadViewer
                    {...baseProps}
                    userThread={userThread}
                    isCollapsedThreadsEnabled={true}
                />,
            );
        });

        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).not.toHaveBeenCalled();
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead on mount when unread replies', async () => {
        vi.useFakeTimers().setSystemTime(400);
        const baseProps = createBaseProps();
        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        await act(async () => {
            renderWithContext(
                <ThreadViewer
                    {...baseProps}
                    userThread={userThread}
                    isCollapsedThreadsEnabled={true}
                />,
            );
        });

        expect(actions.updateThreadLastOpened).toHaveBeenCalledWith('id', 42);
        expect(actions.updateThreadRead).toHaveBeenCalledWith('user_id', 'team_id', 'id', 400);
        expect(actions.getThread).not.toHaveBeenCalled();
    });

    test('should call updateThreadLastOpened and updateThreadRead upon thread id change', async () => {
        vi.useRealTimers();
        const dateNowOrig = Date.now;
        Date.now = () => new Date(400).getMilliseconds();
        const baseProps = createBaseProps();

        const userThread = {
            id: 'id',
            last_viewed_at: 42,
            last_reply_at: 142,
        } as UserThread;

        const {rerender} = renderWithContext(
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

        vi.clearAllMocks();
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

    test('should call fetchRHSAppsBindings on mount if appsEnabled', async () => {
        renderWithContext(
            <ThreadViewer
                {...createBaseProps()}
            />,
        );

        await waitFor(() => {
            expect(actions.fetchRHSAppsBindings).toHaveBeenCalledWith('channel_id', 'id');
        });
    });

    test('should not call fetchRHSAppsBindings on mount if not appsEnabled', async () => {
        renderWithContext(
            <ThreadViewer
                {...createBaseProps()}
                appsEnabled={false}
            />,
        );

        // Wait for component to finish async operations
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalled();
        });

        expect(actions.fetchRHSAppsBindings).not.toHaveBeenCalledWith('channel_id', 'id');
    });

    test('should update thread with highest update_at value when lastUpdateAt is 0', async () => {
        renderWithContext(
            <ThreadViewer
                {...createBaseProps()}
                lastUpdateAt={0} // Set lastUpdateAt to 0
            />,
        );

        // Verify getPostThread was called with lastUpdateAt = 0
        await waitFor(() => {
            expect(actions.getPostThread).toHaveBeenCalledWith(post.id, true, 0);
        });

        // Verify updateThreadLastUpdateAt was called with the highest update_at value
        await waitFor(() => {
            expect(actions.updateThreadLastUpdateAt).toHaveBeenCalledWith(post.id, 2000);
        });
    });

    test('should handle case where root post has the highest update_at value', async () => {
        // Mock with root post having highest update_at
        (actions.getPostThread as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: {
                order: ['post1', 'post2', 'post3'],
                posts: {
                    post1: TestHelper.getPostMock({id: 'post1', update_at: 9000}), // Highest value (root post)
                    post2: TestHelper.getPostMock({id: 'post2', update_at: 2000}),
                    post3: TestHelper.getPostMock({id: 'post3', update_at: 1500}),
                },
            },
        });

        renderWithContext(
            <ThreadViewer
                {...createBaseProps()}
            />,
        );

        // Verify updateThreadLastUpdateAt was called with the highest update_at value
        await waitFor(() => {
            expect(actions.updateThreadLastUpdateAt).toHaveBeenCalledWith(post.id, 9000);
        });
    });
});
