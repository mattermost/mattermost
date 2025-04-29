// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRemoteNamesForChannel, getRemoteInfoForChannel} from './shared_channels';

describe('Selectors.SharedChannels', () => {
    const remote1 = {
        name: 'remote1',
        display_name: 'Remote 1',
        create_at: 1234,
        delete_at: 0,
        last_ping_at: 1235,
    };

    const remote2 = {
        name: 'remote2',
        display_name: 'Remote 2',
        create_at: 1236,
        delete_at: 0,
        last_ping_at: 1237,
    };

    const sharedChannel1 = {
        id: 'channel1',
        team_id: 'team1',
        home: true,
        readonly: false,
        name: 'channel1',
        display_name: 'Channel 1',
        purpose: '',
        header: '',
        creator_id: 'user1',
        create_at: 1238,
        update_at: 1239,
        remote_id: '',
    };

    const sharedChannel2 = {
        id: 'channel2',
        team_id: 'team1',
        home: false,
        readonly: false,
        name: 'channel2',
        display_name: 'Channel 2',
        purpose: '',
        header: '',
        creator_id: 'user1',
        create_at: 1240,
        update_at: 1241,
        remote_id: 'remote1',
    };

    const testState = {
        entities: {
            sharedChannels: {
                sharedChannelsWithRemotes: {
                    channel1: {
                        shared_channel: sharedChannel1,
                        remotes: [remote1, remote2],
                    },
                    channel2: {
                        shared_channel: sharedChannel2,
                        remotes: [remote1],
                    },
                },
            },
        },
    };

    it('getRemoteNamesForChannel', () => {
        expect(getRemoteNamesForChannel(testState, 'channel1')).toEqual(['Remote 1', 'Remote 2']);
        expect(getRemoteNamesForChannel(testState, 'channel2')).toEqual(['Remote 1']);
        expect(getRemoteNamesForChannel(testState, 'non-existent')).toEqual([]);
    });

    it('getRemoteInfoForChannel', () => {
        expect(getRemoteInfoForChannel(testState, 'channel1')).toEqual([remote1, remote2]);
        expect(getRemoteInfoForChannel(testState, 'channel2')).toEqual([remote1]);
        expect(getRemoteInfoForChannel(testState, 'non-existent')).toEqual([]);
    });
});
