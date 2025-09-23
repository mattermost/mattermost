// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import SharedChannelTypes from '../../../action_types/shared_channels';
import {remotes} from '../shared_channels';

describe('shared_channels reducer', () => {
    test('RECEIVED_CHANNEL_REMOTES should store remotes correctly', () => {
        const channelId = 'channel1';
        const remotesList = [
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

        const action = {
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes: remotesList,
            },
        };

        // Start with empty state
        let state = {};
        state = remotes(state, action);

        // Verify the state was updated correctly
        expect(state).toEqual({
            [channelId]: remotesList,
        });

        // Add remotes for another channel
        const channelId2 = 'channel2';
        const remotesList2 = [
            {
                name: 'remote3',
                display_name: 'Remote 3',
                create_at: 555,
                last_ping_at: 666,
                delete_at: 0,
                remote_id: 'r3',
                remote_team_id: 'rt3',
                site_url: 'http://remote3.com',
                creator_id: 'user3',
                plugin_id: 'plugin3',
                topics: 'topics3',
                options: 1,
                default_team_id: 'team3',
            },
        ];

        const action2 = {
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId: channelId2,
                remotes: remotesList2,
            },
        };

        state = remotes(state, action2);

        // Verify the state has both channel's remotes
        expect(state).toEqual({
            [channelId]: remotesList,
            [channelId2]: remotesList2,
        });

        // Update the remotes for the first channel
        const updatedRemotesList = [
            {
                name: 'remote1',
                display_name: 'Remote 1 Updated',
                create_at: 123,
                last_ping_at: 789,
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

        const action3 = {
            type: SharedChannelTypes.RECEIVED_CHANNEL_REMOTES,
            data: {
                channelId,
                remotes: updatedRemotesList,
            },
        };

        state = remotes(state, action3);

        // Verify the first channel's remotes were updated and the second channel's remotes remain unchanged
        expect(state).toEqual({
            [channelId]: updatedRemotesList,
            [channelId2]: remotesList2,
        });
    });

    test('Unknown action type should not modify state', () => {
        const state = {
            channel1: [
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
            ],
        };

        const action = {
            type: 'UNKNOWN_ACTION',
            data: {
                channelId: 'channel1',
                remotes: [
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
                ],
            },
        };

        const newState = remotes(state, action);

        // State should be unchanged
        expect(newState).toBe(state);
    });
});
