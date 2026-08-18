// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, TeamTypes, UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import * as Reducers from './channel_sidebar';

describe('sidebar data load state', () => {
    test('tracks completion of the bulk channel and membership requests', () => {
        expect(Reducers.initChannelsLoaded(false, {type: ChannelTypes.INIT_CHANNELS_LOADED})).toBe(true);
        expect(Reducers.initChannelMembershipsLoaded(false, {type: ChannelTypes.INIT_CHANNEL_MEMBERSHIPS_LOADED})).toBe(true);
    });

    test('ignores unrelated channel and membership responses', () => {
        expect(Reducers.initChannelsLoaded(false, {type: ChannelTypes.RECEIVED_CHANNELS})).toBe(false);
        expect(Reducers.initChannelMembershipsLoaded(false, {type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS})).toBe(false);
    });

    test('resets completion state when switching teams or logging out', () => {
        expect(Reducers.initChannelsLoaded(true, {type: TeamTypes.SELECT_TEAM})).toBe(false);
        expect(Reducers.initChannelMembershipsLoaded(true, {type: TeamTypes.SELECT_TEAM})).toBe(false);
        expect(Reducers.initChannelsLoaded(true, {type: UserTypes.LOGOUT_SUCCESS})).toBe(false);
        expect(Reducers.initChannelMembershipsLoaded(true, {type: UserTypes.LOGOUT_SUCCESS})).toBe(false);
    });
});

describe('multiSelectedChannelIds', () => {
    test('should select single channel when it does not exist in the list', () => {
        const initialState = [
            'channel-1',
            'channel-2',
            'channel-3',
        ];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL,
                data: 'new-channel',
            },
        );

        expect(state).toEqual(['new-channel']);
    });

    test('should select single channel when it does exist in the list', () => {
        const initialState = [
            'channel-1',
            'channel-2',
            'channel-3',
        ];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL,
                data: 'channel-1',
            },
        );

        expect(state).toEqual(['channel-1']);
    });

    test('should remove selection if its the only channel in the list', () => {
        const initialState = [
            'channel-1',
        ];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL,
                data: 'channel-1',
            },
        );

        expect(state).toEqual([]);
    });

    test('should select channel if added with Ctrl+Click and not present in list', () => {
        const initialState = [
            'channel-1',
            'channel-2',
        ];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL_ADD,
                data: 'channel-3',
            },
        );

        expect(state).toEqual([
            'channel-1',
            'channel-2',
            'channel-3',
        ]);
    });

    test('should unselect channel if added with Ctrl+Click and is present in list', () => {
        const initialState = [
            'channel-1',
            'channel-2',
            'channel-3',
        ];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL_ADD,
                data: 'channel-3',
            },
        );

        expect(state).toEqual([
            'channel-1',
            'channel-2',
        ]);
    });

    test('should not update state when clearing without a selection', () => {
        const initialState: string[] = [];

        const state = Reducers.multiSelectedChannelIds(
            initialState,
            {
                type: ActionTypes.MULTISELECT_CHANNEL_CLEAR,
            },
        );

        expect(state).toBe(initialState);
    });
});
