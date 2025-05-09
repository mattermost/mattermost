// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {ActionTypes} from '../../reducers/entities/shared_channels';
import {fetchChannelRemotes, receivedChannelRemotes} from '../shared_channels';

jest.mock('mattermost-redux/client');

describe('shared_channels actions', () => {
    test('receivedChannelRemotes should create the correct action', () => {
        const channelId = 'channel1';
        const remotes = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
                remote_id: 'r1',
                remote_team_id: 'rt1',
                site_url: 'http://remote1.com',
                creator_id: 'user1',
                plugin_id: 'plugin1',
                topics: 'topics1',
                options: 1,
                default_team_id: 'team1',
            },
            {
                name: 'remote2',
                display_name: 'Remote 2',
                create_at: 789,
                last_ping_at: 101,
                delete_at: 0,
                remote_id: 'r2',
                remote_team_id: 'rt2',
                site_url: 'http://remote2.com',
                creator_id: 'user2',
                plugin_id: 'plugin2',
                topics: 'topics2',
                options: 1,
                default_team_id: 'team2',
            },
        ];

        const action = receivedChannelRemotes(channelId, remotes);

        expect(action).toEqual({
            type: ActionTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes,
            },
        });
    });

    test('fetchChannelRemotes should fetch and dispatch remotes', async () => {
        const channelId = 'channel1';
        const remotes = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
                remote_id: 'r1',
                remote_team_id: 'rt1',
                site_url: 'http://remote1.com',
                creator_id: 'user1',
                plugin_id: 'plugin1',
                topics: 'topics1',
                options: 1,
                default_team_id: 'team1',
            },
            {
                name: 'remote2',
                display_name: 'Remote 2',
                create_at: 789,
                last_ping_at: 101,
                delete_at: 0,
                remote_id: 'r2',
                remote_team_id: 'rt2',
                site_url: 'http://remote2.com',
                creator_id: 'user2',
                plugin_id: 'plugin2',
                topics: 'topics2',
                options: 1,
                default_team_id: 'team2',
            },
        ];

        // Mock the client response
        (Client4.getSharedChannelRemoteInfo as jest.Mock).mockResolvedValueOnce(remotes);

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
        expect(Client4.getSharedChannelRemoteInfo).toHaveBeenCalledWith(channelId);

        // Verify the action was dispatched
        expect(dispatch).toHaveBeenCalledWith({
            type: ActionTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes,
            },
        });
    });

    test('fetchChannelRemotes should not fetch if remotes already exist', async () => {
        const channelId = 'channel1';
        const remotes = [
            {
                name: 'remote1',
                display_name: 'Remote 1',
                create_at: 123,
                last_ping_at: 456,
                delete_at: 0,
                remote_id: 'r1',
                remote_team_id: 'rt1',
                site_url: 'http://remote1.com',
                creator_id: 'user1',
                plugin_id: 'plugin1',
                topics: 'topics1',
                options: 1,
                default_team_id: 'team1',
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
        expect(Client4.getSharedChannelRemoteInfo).not.toHaveBeenCalled();

        // Verify no action was dispatched
        expect(dispatch).not.toHaveBeenCalled();
    });
});
