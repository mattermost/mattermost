// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelJoinRequest, ChannelJoinRequestsState} from '@mattermost/types/channels';

import {ChannelTypes, UserTypes} from 'mattermost-redux/action_types';

import {joinRequests} from '../channels';

const emptyState: ChannelJoinRequestsState = {
    myPendingByChannel: {},
    byChannel: {},
    countsByChannel: {},
    myList: [],
};

function pendingRow(overrides: Partial<ChannelJoinRequest> = {}): ChannelJoinRequest {
    return {
        id: 'req1',
        channel_id: 'channel1',
        user_id: 'user1',
        message: 'please',
        status: 'pending',
        denial_reason: '',
        create_at: 1000,
        update_at: 1000,
        reviewed_by: '',
        reviewed_at: 0,
        ...overrides,
    };
}

describe('joinRequests reducer', () => {
    test('returns initial empty state', () => {
        expect(joinRequests(undefined, {type: 'unknown'} as any)).toEqual(emptyState);
    });

    test('RECEIVED_MY_CHANNEL_JOIN_REQUEST stores a pending row', () => {
        const req = pendingRow();
        const next = joinRequests(emptyState, {
            type: ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
            data: req,
        });
        expect(next.myPendingByChannel.channel1).toEqual(req);
    });

    test('RECEIVED_MY_CHANNEL_JOIN_REQUEST clears myPending entry on terminal status', () => {
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            myPendingByChannel: {channel1: pendingRow()},
        };
        const next = joinRequests(seed, {
            type: ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
            data: pendingRow({status: 'approved'}),
        });
        expect(next.myPendingByChannel.channel1).toBeUndefined();
    });

    test('CHANNEL_JOIN_REQUEST_CREATED inserts into admin list and bumps count', () => {
        const req = pendingRow();
        const next = joinRequests(emptyState, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_CREATED,
            data: req,
        });
        expect(next.byChannel.channel1).toHaveLength(1);
        expect(next.byChannel.channel1[0].id).toBe('req1');
        expect(next.countsByChannel.channel1).toBe(1);
    });

    test('CHANNEL_JOIN_REQUEST_CREATED is idempotent on duplicate row', () => {
        const req = pendingRow();
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            byChannel: {channel1: [req]},
            countsByChannel: {channel1: 1},
        };
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_CREATED,
            data: req,
        });

        // Row dedup keeps the list at length 1.
        expect(next.byChannel.channel1).toHaveLength(1);

        // The count must NOT bump for a row already tracked — a re-delivered
        // CREATED event should be idempotent.
        expect(next.countsByChannel.channel1).toBe(1);
    });

    test('CHANNEL_JOIN_REQUEST_UPDATED replaces row, clears myPending and decrements count on terminal', () => {
        const pending = pendingRow();
        const seed: ChannelJoinRequestsState = {
            myPendingByChannel: {channel1: pending},
            byChannel: {channel1: [pending]},
            countsByChannel: {channel1: 1},
            myList: [pending],
        };
        const approved = pendingRow({status: 'approved', reviewed_by: 'admin1', reviewed_at: 2000});
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: approved,
        });
        expect(next.byChannel.channel1[0].status).toBe('approved');
        expect(next.myPendingByChannel.channel1).toBeUndefined();
        expect(next.countsByChannel.channel1).toBe(0);
        expect(next.myList[0].status).toBe('approved');
    });

    test('CHANNEL_JOIN_REQUEST_UPDATED does not double-decrement when transitioning between non-pending states', () => {
        const denied = pendingRow({status: 'denied', reviewed_at: 2000});
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            byChannel: {channel1: [denied]},
            countsByChannel: {channel1: 0},
        };
        const stillDenied = pendingRow({status: 'denied', reviewed_at: 3000, denial_reason: 'edit'});
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: stillDenied,
        });

        // The count does NOT go negative — we floor at 0. This guards against
        // ordering bugs where a CREATED bump is missed but UPDATED arrives.
        expect(next.countsByChannel.channel1).toBe(0);
    });

    test('CHANNEL_JOIN_REQUEST_UPDATED does not double-decrement on the local dispatch + WebSocket echo of a single approval', () => {
        // Two pending requests are tracked; the acting admin approves one.
        const pending1 = pendingRow({id: 'req1'});
        const pending2 = pendingRow({id: 'req2', channel_id: 'channel1'});
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            byChannel: {channel1: [pending1, pending2]},
            countsByChannel: {channel1: 2},
        };

        const approved = pendingRow({id: 'req1', status: 'approved', reviewed_at: 2000});

        // First dispatch (optimistic, from the patchChannelJoinRequest thunk).
        const afterLocal = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: approved,
        });
        expect(afterLocal.countsByChannel.channel1).toBe(1);

        // Second dispatch: the server broadcasts the same transition back to
        // the actor. The tracked row is already terminal, so it is a no-op.
        const afterEcho = joinRequests(afterLocal, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: approved,
        });
        expect(afterEcho.countsByChannel.channel1).toBe(1);
    });

    test('CHANNEL_JOIN_REQUEST_UPDATED decrements once when only the count is loaded (queue not open)', () => {
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            countsByChannel: {channel1: 3},
        };
        const approved = pendingRow({status: 'approved', reviewed_at: 2000});
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: approved,
        });
        expect(next.countsByChannel.channel1).toBe(2);

        // The untracked row is now persisted, so a re-delivered terminal event
        // finds it as terminal and does not decrement the count again.
        expect(next.byChannel.channel1).toHaveLength(1);
        const afterDuplicate = joinRequests(next, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_UPDATED,
            data: approved,
        });
        expect(afterDuplicate.countsByChannel.channel1).toBe(2);
    });

    test('CHANNEL_JOIN_REQUEST_REMOVED drops myPending entry', () => {
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            myPendingByChannel: {channel1: pendingRow()},
        };
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_REMOVED,
            data: {channel_id: 'channel1'},
        });
        expect(next.myPendingByChannel.channel1).toBeUndefined();
    });

    test('CHANNEL_JOIN_REQUEST_REMOVED with request_id also drops from byChannel and myList', () => {
        const row = pendingRow();
        const seed: ChannelJoinRequestsState = {
            myPendingByChannel: {channel1: row},
            byChannel: {channel1: [row]},
            countsByChannel: {channel1: 1},
            myList: [row],
        };
        const next = joinRequests(seed, {
            type: ChannelTypes.CHANNEL_JOIN_REQUEST_REMOVED,
            data: {channel_id: 'channel1', request_id: 'req1'},
        });
        expect(next.byChannel.channel1).toHaveLength(0);
        expect(next.myList).toHaveLength(0);
    });

    test('RECEIVED_MY_CHANNEL_JOIN_REQUESTS hydrates myList and myPending map from pending rows only', () => {
        const pending = pendingRow();
        const denied = pendingRow({id: 'req2', channel_id: 'channel2', status: 'denied'});
        const next = joinRequests(emptyState, {
            type: ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS,
            data: {requests: [pending, denied], total_count: 2},
        });
        expect(next.myList).toHaveLength(2);
        expect(Object.keys(next.myPendingByChannel)).toEqual(['channel1']);
    });

    test('RECEIVED_MY_CHANNEL_JOIN_REQUESTS prunes stale pending entries not in the fresh list', () => {
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            myPendingByChannel: {channelStale: pendingRow({id: 'reqStale', channel_id: 'channelStale'})},
        };
        const fresh = pendingRow();
        const next = joinRequests(seed, {
            type: ChannelTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS,
            data: {requests: [fresh], total_count: 1},
        });
        expect(Object.keys(next.myPendingByChannel)).toEqual(['channel1']);
        expect(next.myPendingByChannel.channelStale).toBeUndefined();
    });

    test('RECEIVED_CHANNEL_JOIN_REQUESTS replaces admin queue list for that channel', () => {
        const seed: ChannelJoinRequestsState = {
            ...emptyState,
            byChannel: {channel1: [pendingRow()]},
        };
        const fresh = pendingRow({id: 'req2'});
        const next = joinRequests(seed, {
            type: ChannelTypes.RECEIVED_CHANNEL_JOIN_REQUESTS,
            data: {channel_id: 'channel1', list: {requests: [fresh], total_count: 1}},
        });
        expect(next.byChannel.channel1).toHaveLength(1);
        expect(next.byChannel.channel1[0].id).toBe('req2');
    });

    test('RECEIVED_CHANNEL_JOIN_REQUEST_COUNT stores per-channel count', () => {
        const next = joinRequests(emptyState, {
            type: ChannelTypes.RECEIVED_CHANNEL_JOIN_REQUEST_COUNT,
            data: {channel_id: 'channel1', count: 5},
        });
        expect(next.countsByChannel.channel1).toBe(5);
    });

    test('LOGOUT_SUCCESS resets to initial state', () => {
        const seed: ChannelJoinRequestsState = {
            myPendingByChannel: {channel1: pendingRow()},
            byChannel: {channel1: [pendingRow()]},
            countsByChannel: {channel1: 1},
            myList: [pendingRow()],
        };
        const next = joinRequests(seed, {type: UserTypes.LOGOUT_SUCCESS});
        expect(next).toEqual(emptyState);
    });
});
