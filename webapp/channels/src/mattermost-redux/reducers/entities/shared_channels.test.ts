// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'mattermost-redux/action_types';

import {sharedChannelsWithRemotes} from './shared_channels';

describe('Reducers.SharedChannels.sharedChannelsWithRemotes', () => {
    it('should return default state when no action is provided', () => {
        const state = sharedChannelsWithRemotes(undefined, {type: 'no-action'});
        expect(state).toEqual({});
    });

    it('should store shared channels with remotes when received', () => {
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

        const channel1 = {
            channel_id: 'channel1',
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

        const channel2 = {
            channel_id: 'channel2',
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

        const sharedChannelsData = [
            {
                shared_channel: channel1,
                remotes: [remote1, remote2],
            },
            {
                shared_channel: channel2,
                remotes: [remote1],
            },
        ];

        const action = {
            type: ActionTypes.RECEIVED_SHARED_CHANNELS_WITH_REMOTES,
            data: sharedChannelsData,
        };

        const state = sharedChannelsWithRemotes({}, action);

        expect(state).toEqual({
            channel1: {
                shared_channel: channel1,
                remotes: [remote1, remote2],
            },
            channel2: {
                shared_channel: channel2,
                remotes: [remote1],
            },
        });
    });

    it('should merge new shared channels with existing ones', () => {
        const initialState = {
            channel1: {
                shared_channel: {
                    channel_id: 'channel1',
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
                },
                remotes: [
                    {
                        name: 'remote1',
                        display_name: 'Remote 1',
                        create_at: 1234,
                        delete_at: 0,
                        last_ping_at: 1235,
                    },
                ],
            },
        };

        const newChannel = {
            channel_id: 'channel2',
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

        const newRemote = {
            name: 'remote2',
            display_name: 'Remote 2',
            create_at: 1236,
            delete_at: 0,
            last_ping_at: 1237,
        };

        const action = {
            type: ActionTypes.RECEIVED_SHARED_CHANNELS_WITH_REMOTES,
            data: [
                {
                    shared_channel: newChannel,
                    remotes: [newRemote],
                },
            ],
        };

        const state = sharedChannelsWithRemotes(initialState, action);

        expect(state).toEqual({
            channel1: initialState.channel1,
            channel2: {
                shared_channel: newChannel,
                remotes: [newRemote],
            },
        });
    });
});
