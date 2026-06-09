// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {loadProfilesForSidebar} from 'actions/user_actions';

import {renderWithContext, runPostRenderAct} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DataPrefetch from './data_prefetch';

const mockQueue: Array<() => Promise<void>> = [];

jest.mock('p-queue', () => class PQueueMock {
    add = (o: () => Promise<void>) => mockQueue.push(o);
    clear = () => mockQueue.splice(0, mockQueue.length);
});

jest.mock('actions/user_actions', () => ({
    loadProfilesForSidebar: jest.fn(() => Promise.resolve({})),
}));

describe('/components/data_prefetch', () => {
    const defaultProps = {
        currentChannelId: '',
        actions: {
            prefetchChannelPosts: jest.fn(() => Promise.resolve({})),
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
        jest.clearAllMocks();
    });

    test('should fetch posts for current channel on first channel load', async () => {
        const props = {...defaultProps};
        const {rerender} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        // Change channels and wait for async componentDidUpdate to resolve
        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
            />,
        );
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(1);

        // Manually run queued tasks
        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);
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
        await runPostRenderAct();

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);

        // Reload the sidebar - should not call again
        rerender(
            <DataPrefetch
                {...props}
                sidebarLoaded={true}
            />,
        );
        await Promise.resolve(true);

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
    });

    test('should fetch channels in priority order', async () => {
        const props = {
            ...defaultProps,
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
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(5); // current channel, mentioned channels, unread channels

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel0', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(3);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel1', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(4);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel0', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(5);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel1', undefined);
    });

    test('should cancel fetch and requeue channels when prefetch queue changes', async () => {
        const props = {
            ...defaultProps,
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
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(4);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel0', undefined);

        const newPrefetchQueueObj = {
            1: ['mentionChannel0', 'mentionChannel1'],
            2: ['unreadChannel2', 'unreadChannel3'],
        };

        rerender(
            <DataPrefetch
                {...props}
                currentChannelId='currentChannelId'
                prefetchQueueObj={newPrefetchQueueObj}
            />,
        );

        // Check queue has been cleared and wait for async componentDidUpdate to complete
        expect(mockQueue).toHaveLength(0);
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(4);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(3);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel0', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(4);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel1', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(5);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel2', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(6);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('unreadChannel3', undefined);
    });

    test('should skip making request for posts if a request was made', async () => {
        const props = {
            ...defaultProps,
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
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(2);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', undefined);
    });

    test('should add delay if last post is made in last min', async () => {
        Date.now = jest.fn().mockReturnValue(12346);
        Math.random = jest.fn().mockReturnValue(0.5);

        const props = {
            ...defaultProps,
            prefetchQueueObj: {
                1: ['mentionChannel'],
            },
            unreadChannels: [{
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
            }],
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
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(2);

        // The first channel is loaded with no delay
        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        // And the second is loaded with a half second delay
        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', 500);
    });

    test('should not add delay if channel is DM even if last post is made in last min', async () => {
        Date.now = jest.fn().mockReturnValue(12346);
        Math.random = jest.fn().mockReturnValue(0.5);

        const props = {
            ...defaultProps,
            prefetchQueueObj: {
                1: ['mentionChannel'],
            },
            unreadChannels: [{
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
            }],
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
        await runPostRenderAct();

        expect(mockQueue).toHaveLength(2);

        // The first channel is loaded with no delay
        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(1);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('currentChannelId', undefined);

        // And the second is loaded with no delay either
        mockQueue.shift()!();
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledTimes(2);
        expect(props.actions.prefetchChannelPosts).toHaveBeenCalledWith('mentionChannel', undefined);
    });

    test('should load profiles once the sidebar is loaded irrespective of the current channel', () => {
        const props = {
            ...defaultProps,
            currentChannelId: '',
            sidebarLoaded: false,
        };

        const {rerender, unmount} = renderWithContext(
            <DataPrefetch {...props}/>,
        );

        // Rerender with same props - no sidebar loaded
        rerender(<DataPrefetch {...props}/>);

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

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        rerender2(
            <DataPrefetch
                {...props}
                currentChannelId='channel'
                sidebarLoaded={true}
            />,
        );

        expect(loadProfilesForSidebar).toHaveBeenCalled();
    });
});
