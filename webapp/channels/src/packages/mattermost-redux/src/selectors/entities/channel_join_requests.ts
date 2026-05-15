// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel, ChannelJoinRequest} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

export function getMyChannelJoinRequestForChannel(state: GlobalState, channelId: Channel['id']): ChannelJoinRequest | null | undefined {
    // `undefined` means we haven't asked the server yet; `null` means we
    // have, and there is no pending request.
    return state.entities.channelJoinRequests.pendingByMe[channelId];
}

export function hasPendingJoinRequest(state: GlobalState, channelId: Channel['id']): boolean {
    const req = state.entities.channelJoinRequests.pendingByMe[channelId];
    return Boolean(req && req.status === 'pending');
}

export function getPendingJoinRequestsForChannel(state: GlobalState, channelId: Channel['id']): Record<string, ChannelJoinRequest> {
    return state.entities.channelJoinRequests.pendingByChannel[channelId] ?? {};
}

export function getPendingJoinRequestCount(state: GlobalState, channelId: Channel['id']): number {
    return state.entities.channelJoinRequests.pendingCounts[channelId] ?? 0;
}

export const getMyPendingJoinRequests: (state: GlobalState) => ChannelJoinRequest[] = createSelector(
    'getMyPendingJoinRequests',
    (state: GlobalState) => state.entities.channelJoinRequests.pendingByMe,
    (pendingByMe) => {
        const out: ChannelJoinRequest[] = [];
        for (const req of Object.values(pendingByMe)) {
            if (req && req.status === 'pending') {
                out.push(req);
            }
        }
        return out.sort((a, b) => b.create_at - a.create_at);
    },
);
