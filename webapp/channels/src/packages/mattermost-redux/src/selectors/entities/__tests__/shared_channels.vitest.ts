// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRemoteNamesForChannel, getRemotesForChannel} from '../shared_channels';

describe('shared_channels selectors', () => {
    const channelId = 'channel1';
    const remotes = [
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

    const state = {
        entities: {
            sharedChannels: {
                remotes: {
                    [channelId]: remotes,
                },
            },
        },
    };

    test('getRemoteNamesForChannel should return display names from remotes', () => {
        const result = getRemoteNamesForChannel(state as any, channelId);
        expect(result).toEqual(['Remote 1', 'Remote 2']);
    });

    test('getRemoteNamesForChannel should return empty array when no remotes exist', () => {
        const result = getRemoteNamesForChannel(state as any, 'nonexistent_channel');
        expect(result).toEqual([]);
    });

    test('getRemotesForChannel should return all remote info', () => {
        const result = getRemotesForChannel(state as any, channelId);
        expect(result).toEqual(remotes);
    });

    test('getRemotesForChannel should return empty array when no remotes exist', () => {
        const result = getRemotesForChannel(state as any, 'nonexistent_channel');
        expect(result).toEqual([]);
    });
});
