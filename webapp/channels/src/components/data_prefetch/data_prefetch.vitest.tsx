// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {loadProfilesForSidebar} from 'actions/user_actions';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DataPrefetch from './data_prefetch';

const mockQueue: Array<() => Promise<void>> = [];

vi.mock('p-queue', () => ({
    default: class PQueueMock {
        add = (o: () => Promise<void>) => mockQueue.push(o);
        clear = () => mockQueue.splice(0, mockQueue.length);
    },
}));

vi.mock('actions/user_actions', () => ({
    loadProfilesForSidebar: vi.fn(() => Promise.resolve({})),
}));

describe('/components/data_prefetch', () => {
    const defaultProps = {
        currentChannelId: '',
        actions: {
            prefetchChannelPosts: vi.fn(() => Promise.resolve({})),
        },
        prefetchQueueObj: {
            1: [],
        },
        prefetchRequestStatus: {},
        sidebarLoaded: true,
        unreadChannels: [TestHelper.getChannelMock({
            id: 'mentionChannel',
            display_name: 'mentionChannel',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: 'team_id',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            last_post_at: 1234,
            last_root_post_at: 1234,
        }), TestHelper.getChannelMock({
            id: 'unreadChannel',
            display_name: 'unreadChannel',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: 'team_id',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            last_post_at: 1235,
            last_root_post_at: 1235,
        })],
    };

    beforeEach(() => {
        mockQueue.splice(0, mockQueue.length);
        vi.clearAllMocks();
    });

    test('should fetch posts for current channel on first channel load', async () => {
        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        // Change channels and wait for async effect to resolve
        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(1);
        expect(prefetchChannelPosts).not.toHaveBeenCalled();

        // Manually run queued tasks
        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);
    });

    test('should fetch profiles for sidebar on sidebar load', async () => {
        const props = {
            ...defaultProps,
            sidebarLoaded: false,
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        // Finish loading the sidebar
        rerender(
            <DataPrefetch
                {...props}
                sidebarLoaded={true}
            />,
        );
        await Promise.resolve();

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);

        // Reload the sidebar
        rerender(
            <DataPrefetch
                {...props}
                sidebarLoaded={true}
            />,
        );
        await Promise.resolve();

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
    });

    test('should fetch channels in priority order', async () => {
        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
            prefetchQueueObj: {
                1: ['mentionChannel0', 'mentionChannel1'],
                2: ['unreadChannel0', 'unreadChannel1'],
                3: [],
            },
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(5); // current channel, mentioned channels, unread channels
        expect(prefetchChannelPosts).not.toHaveBeenCalled();

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel0', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(3);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel1', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(4);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel0', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(5);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel1', undefined);
    });

    test('should cancel fetch and requeue channels when prefetch queue changes', async () => {
        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
            prefetchQueueObj: {
                1: [],
                2: ['unreadChannel0', 'unreadChannel1', 'unreadChannel2'],
            },
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(4);
        expect(prefetchChannelPosts).not.toHaveBeenCalled();

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel0', undefined);

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
                prefetchQueueObj={{
                    1: ['mentionChannel0', 'mentionChannel1'],
                    2: ['unreadChannel2', 'unreadChannel3'],
                }}
            />,
        );

        // Check queue has been cleared and wait for async effect to complete
        expect(mockQueue).toHaveLength(0);
        await Promise.resolve();

        expect(mockQueue).toHaveLength(4);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(3);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel0', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(4);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel1', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(5);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel2', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(6);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel3', undefined);
    });

    test('should skip making request for posts if a request was made', async () => {
        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
            prefetchQueueObj: {
                1: ['mentionChannel'],
                2: ['unreadChannel'],
            },
            prefetchRequestStatus: {
                unreadChannel: 'success',
            },
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(2);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', undefined);
    });

    test('should add delay if last post is made in last min', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(12346);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
            prefetchQueueObj: {
                1: ['mentionChannel'],
            },
            unreadChannels: [TestHelper.getChannelMock({
                id: 'mentionChannel',
                display_name: 'mentionChannel',
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                team_id: 'team_id',
                type: 'O' as ChannelType,
                name: '',
                header: '',
                purpose: '',
                creator_id: '',
                scheme_id: '',
                group_constrained: false,
                last_post_at: 12345,
                last_root_post_at: 12345,
            })],
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(2);

        // The first channel is loaded with no delay
        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        // And the second is loaded with a half second delay
        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', 500);
    });

    test('should not add delay if channel is DM even if last post is made in last min', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(12346);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const prefetchChannelPosts = vi.fn(() => Promise.resolve({}));
        const props = {
            ...defaultProps,
            actions: {prefetchChannelPosts},
            prefetchQueueObj: {
                1: ['mentionChannel'],
            },
            unreadChannels: [TestHelper.getChannelMock({
                id: 'mentionChannel',
                display_name: 'mentionChannel',
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                team_id: 'team_id',
                type: 'D' as ChannelType,
                name: '',
                header: '',
                purpose: '',
                creator_id: '',
                scheme_id: '',
                group_constrained: false,
                last_post_at: 12345,
                last_root_post_at: 12345,
            })],
        };

        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await Promise.resolve();

        expect(mockQueue).toHaveLength(2);

        // The first channel is loaded with no delay
        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        // And the second is loaded with no delay either
        await mockQueue.shift()!();
        expect(prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', undefined);
    });

    test('should load profiles once the sidebar is loaded irrespective of the current channel', async () => {
        const props = {
            ...defaultProps,
            currentChannelId: '',
            sidebarLoaded: false,
        };

        const {rerender, unmount} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender(
            <DataPrefetch {...props}/>,
        );
        await Promise.resolve();

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        unmount();

        // With current channel loaded first
        const {rerender: rerender2} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        rerender2(
            <DataPrefetch
                {...props}
                currentChannelId='channel'
            />,
        );
        await Promise.resolve();

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        rerender2(
            <DataPrefetch
                {...props}
                currentChannelId='channel'
                sidebarLoaded={true}
            />,
        );
        await Promise.resolve();

        expect(loadProfilesForSidebar).toHaveBeenCalled();
    });
});
