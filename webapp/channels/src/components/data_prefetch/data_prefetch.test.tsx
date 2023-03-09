// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {ChannelType} from '@mattermost/types/channels';

import {loadProfilesForSidebar} from 'actions/user_actions';

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
            trackPreloadedChannels: jest.fn(),
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
    });

    test('should fetch posts for current channel on first channel load', async () => {
        const props = defaultProps;
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        const instance = wrapper.instance();
        instance.prefetchPosts = jest.fn();

        // Change channels and wait for async componentDidUpdate to resolve
        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(1);
        expect(instance.prefetchPosts).not.toHaveBeenCalled();

        // Manually run queued tasks
        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(1);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('currentChannelId');
    });

    test('should fetch profiles for sidebar on first channel load', async () => {
        const props = defaultProps;
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        // Change channels
        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);

        // Change channels again
        wrapper.setProps({currentChannelId: 'anotherChannelId'});
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
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        const instance = wrapper.instance();
        instance.prefetchPosts = jest.fn();

        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(5); // current channel, mentioned channels, unread channels
        expect(instance.prefetchPosts).not.toHaveBeenCalled();

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(1);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('currentChannelId');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(2);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('mentionChannel0');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(3);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('mentionChannel1');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(4);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('unreadChannel0');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(5);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('unreadChannel1');
    });

    test('should cancel fetch and requeue channels when prefetch queue changes', async () => {
        const props = {
            ...defaultProps,
            prefetchQueueObj: {
                1: [],
                2: ['unreadChannel0', 'unreadChannel1', 'unreadChannel2'],
            },
        };
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        const instance = wrapper.instance();
        instance.prefetchPosts = jest.fn();

        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(4);
        expect(instance.prefetchPosts).not.toHaveBeenCalled();

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(1);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('currentChannelId');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(2);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('unreadChannel0');

        wrapper.setProps({
            prefetchQueueObj: {
                1: ['mentionChannel0', 'mentionChannel1'],
                2: ['unreadChannel2', 'unreadChannel3'],
            },
        });

        // Check queue has been cleared and wait for async componentDidUpdate to complete
        expect(mockQueue).toHaveLength(0);
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(4);

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(3);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('mentionChannel0');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(4);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('mentionChannel1');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(5);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('unreadChannel2');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(6);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('unreadChannel3');
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
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        const instance = wrapper.instance();
        instance.prefetchPosts = jest.fn();

        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

        expect(mockQueue).toHaveLength(2);

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(1);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('currentChannelId');

        mockQueue.shift()!();
        expect(instance.prefetchPosts).toHaveBeenCalledTimes(2);
        expect(instance.prefetchPosts).toHaveBeenCalledWith('mentionChannel');
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
        const wrapper = shallow(
            <DataPrefetch {...props}/>,
        );

        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

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
        const wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );

        wrapper.setProps({currentChannelId: 'currentChannelId'});
        await Promise.resolve(true);

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

    test('should load profiles once the current channel and sidebar are both loaded', () => {
        const props = {
            ...defaultProps,
            currentChannelId: '',
            sidebarLoaded: false,
        };

        let wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );
        wrapper.setProps({});

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        // With current channel loaded first
        wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );
        wrapper.setProps({
            currentChannelId: 'channel',
        });

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        wrapper.setProps({
            sidebarLoaded: true,
        });

        expect(loadProfilesForSidebar).toHaveBeenCalled();

        jest.clearAllMocks();

        // With sidebar loaded first
        wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );
        wrapper.setProps({
            sidebarLoaded: true,
        });

        expect(loadProfilesForSidebar).not.toHaveBeenCalled();

        wrapper.setProps({
            currentChannelId: 'channel',
        });

        expect(loadProfilesForSidebar).toHaveBeenCalled();

        jest.clearAllMocks();

        // With both loaded at once
        wrapper = shallow<DataPrefetch>(
            <DataPrefetch {...props}/>,
        );
        wrapper.setProps({
            currentChannelId: 'channel',
            sidebarLoaded: true,
        });

        expect(loadProfilesForSidebar).toHaveBeenCalled();
    });
});
