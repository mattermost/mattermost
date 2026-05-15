// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelJoinRequest} from '@mattermost/types/channels';

import {ChannelJoinRequestTypes, UserTypes} from 'mattermost-redux/action_types';

import {pendingByMe, pendingByChannel, pendingCounts} from './channel_join_requests';

const pendingRequest = (overrides: Partial<ChannelJoinRequest> = {}): ChannelJoinRequest => ({
    id: 'req1',
    channel_id: 'channel1',
    user_id: 'user1',
    message: '',
    status: 'pending',
    denial_reason: '',
    create_at: 1,
    update_at: 1,
    reviewed_by: '',
    reviewed_at: 0,
    ...overrides,
});

describe('reducers/entities/channel_join_requests', () => {
    describe('pendingByMe', () => {
        test('stores a received request keyed by channel id', () => {
            const req = pendingRequest();
            const next = pendingByMe(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
                data: {channelId: req.channel_id, request: req},
            });

            expect(next).toEqual({channel1: req});
        });

        test('stores null when the server confirms no pending request', () => {
            const next = pendingByMe(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
                data: {channelId: 'channel1', request: null},
            });

            expect(next).toEqual({channel1: null});
        });

        test('clears the slot when the request becomes non-pending', () => {
            const initial = {channel1: pendingRequest()};
            const next = pendingByMe(initial, {
                type: ChannelJoinRequestTypes.CLEARED_MY_CHANNEL_JOIN_REQUEST,
                data: {channelId: 'channel1'},
            });

            expect(next).toEqual({channel1: null});
        });

        test('rebuilds the map from a list, dropping non-pending statuses', () => {
            const pending = pendingRequest({id: 'r1', channel_id: 'c1'});
            const denied = pendingRequest({id: 'r2', channel_id: 'c2', status: 'denied'});

            const next = pendingByMe(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS,
                data: {requests: [pending, denied]},
            });

            expect(next).toEqual({c1: pending, c2: null});
        });

        test('resets on logout', () => {
            const initial = {channel1: pendingRequest()};
            const next = pendingByMe(initial, {type: UserTypes.LOGOUT_SUCCESS});
            expect(next).toEqual({});
        });
    });

    describe('pendingByChannel', () => {
        test('replaces the per-channel pending list, dropping terminal statuses', () => {
            const pending = pendingRequest({id: 'r1'});
            const denied = pendingRequest({id: 'r2', status: 'denied'});

            const next = pendingByChannel(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUESTS,
                data: {channelId: 'channel1', requests: [pending, denied]},
            });

            expect(next).toEqual({channel1: {r1: pending}});
        });

        test('removes a request when it transitions to non-pending', () => {
            const initial = {channel1: {r1: pendingRequest({id: 'r1'})}};

            const next = pendingByChannel(initial, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
                data: pendingRequest({id: 'r1', status: 'approved'}),
            });

            expect(next).toEqual({channel1: {}});
        });

        test('keeps the request when it stays pending', () => {
            const updated = pendingRequest({id: 'r1', message: 'updated'});

            const next = pendingByChannel(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
                data: updated,
            });

            expect(next).toEqual({channel1: {r1: updated}});
        });
    });

    describe('pendingCounts', () => {
        test('sets the count directly when received', () => {
            const next = pendingCounts(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_PENDING_JOIN_REQUESTS_COUNT,
                data: {channelId: 'channel1', count: 4},
            });

            expect(next).toEqual({channel1: 4});
        });

        test('increments for a new pending request', () => {
            const next = pendingCounts(undefined, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
                data: pendingRequest(),
            });

            expect(next).toEqual({channel1: 1});
        });

        test('decrements when a request transitions out of pending', () => {
            const next = pendingCounts({channel1: 3}, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
                data: pendingRequest({status: 'approved'}),
            });

            expect(next).toEqual({channel1: 2});
        });

        test('uses the authoritative total when provided', () => {
            const next = pendingCounts({channel1: 100}, {
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUESTS,
                data: {channelId: 'channel1', requests: [], total: 5},
            });

            expect(next).toEqual({channel1: 5});
        });
    });
});
