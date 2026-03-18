// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

import {Client4} from 'mattermost-redux/client';

import SharedChannelTypes from '../../action_types/shared_channels';
import {fetchChannelRemotes, receivedChannelRemotes} from '../shared_channels';

jest.mock('mattermost-redux/client');

describe('shared_channels actions', () => {
    test('receivedChannelRemotes should create the correct action', () => {
        const channelId = 'channel1';
        const remotes: RemoteClusterInfo[] = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
            },
            {
                name: 'remote2',
                display_name: 'Remote 2',
                create_at: 789,
                last_ping_at: 101,
                delete_at: 0,
            },
        ];

        const action = receivedChannelRemotes(channelId, remotes);

        expect(action).toEqual({
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes,
            },
        });
    });

    test('fetchChannelRemotes should fetch and dispatch remotes', async () => {
        const channelId = 'channel1';
        const remotes: RemoteClusterInfo[] = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
            },
            {
                name: 'remote2',
                display_name: 'Remote 2',
                create_at: 789,
                last_ping_at: 101,
                delete_at: 0,
            },
        ];

        // Mock the client response
        (Client4.getSharedChannelRemoteInfos as jest.Mock).mockResolvedValueOnce(remotes);

        // Mock the getState function to return no existing remotes
        const getState = jest.fn().mockReturnValue({
            entities: {
                sharedChannels: {
                    remotes: {},
                },
            },
        });
        const dispatch = jest.fn();

        await fetchChannelRemotes(channelId)(dispatch, getState, {});

        // Verify Client4 was called
        expect(Client4.getSharedChannelRemoteInfos).toHaveBeenCalledWith(channelId);

        // Verify the action was dispatched
        expect(dispatch).toHaveBeenCalledWith({
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes,
            },
        });
    });

    test('fetchChannelRemotes should not fetch if remotes already exist and no refresh is requested', async () => {
        const channelId = 'channel1';
        const remotes: RemoteClusterInfo[] = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
            },
        ];

        // Mock the getState function to return existing remotes
        const getState = jest.fn().mockReturnValue({
            entities: {
                sharedChannels: {
                    remotes: {
                        [channelId]: remotes,
                    },
                },
            },
        });
        const dispatch = jest.fn();

        await fetchChannelRemotes(channelId)(dispatch, getState, {});

        // Verify Client4 was NOT called
        expect(Client4.getSharedChannelRemoteInfos).not.toHaveBeenCalled();

        // Verify no action was dispatched
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('fetchChannelRemotes should fetch if remotes exist but forceRefresh is true', async () => {
        const channelId = 'channel1';
        const existingRemotes: RemoteClusterInfo[] = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
            },
        ];

        const newRemotes: RemoteClusterInfo[] = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
            },
            {
                name: 'remote2',
                display_name: 'Remote 2',
                create_at: 789,
                last_ping_at: 101,
                delete_at: 0,
            },
        ];

        // Mock the getState function to return existing remotes
        const getState = jest.fn().mockReturnValue({
            entities: {
                sharedChannels: {
                    remotes: {
                        [channelId]: existingRemotes,
                    },
                },
            },
        });
        const dispatch = jest.fn();

        // Mock the client response to return updated remotes
        (Client4.getSharedChannelRemoteInfos as jest.Mock).mockResolvedValueOnce(newRemotes);

        await fetchChannelRemotes(channelId, true)(dispatch, getState, {});

        // Verify Client4 was called
        expect(Client4.getSharedChannelRemoteInfos).toHaveBeenCalledWith(channelId);

        // Verify the action was dispatched with the new remotes
        expect(dispatch).toHaveBeenCalledWith({
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes: newRemotes,
            },
        });
    });
});
