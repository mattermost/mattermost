// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelJoinRequest, ChannelJoinRequestsState} from '@mattermost/types/channels';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ChannelJoinRequestTypes, UserTypes} from 'mattermost-redux/action_types';

// Pending join requests submitted by the currently authenticated user keyed
// by channel id. We deliberately store `null` for confirmed-empty lookups so
// callers can tell "no request" from "not yet fetched".
export function pendingByMe(state: ChannelJoinRequestsState['pendingByMe'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST: {
        const {channelId, request} = action.data as {channelId: string; request: ChannelJoinRequest | null};
        return {
            ...state,
            [channelId]: request,
        };
    }

    case ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS: {
        const requests: ChannelJoinRequest[] = action.data.requests || [];
        const nextState = {...state};
        for (const req of requests) {
            // Server returns pending only when filtered, but defensively map
            // every status so the slice stays consistent with what the
            // backend told us.
            nextState[req.channel_id] = req.status === 'pending' ? req : null;
        }
        return nextState;
    }

    case ChannelJoinRequestTypes.CLEARED_MY_CHANNEL_JOIN_REQUEST: {
        const {channelId} = action.data as {channelId: string};
        return {
            ...state,
            [channelId]: null,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function pendingByChannel(state: ChannelJoinRequestsState['pendingByChannel'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUESTS: {
        const {channelId, requests} = action.data as {channelId: string; requests: ChannelJoinRequest[]};

        // Replace the per-channel map for this channel so cleared rows
        // (approved / denied / withdrawn) no longer appear in the queue.
        const byId: Record<string, ChannelJoinRequest> = {};
        for (const req of requests) {
            if (req.status === 'pending') {
                byId[req.id] = req;
            }
        }
        return {
            ...state,
            [channelId]: byId,
        };
    }

    case ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST: {
        const request = action.data as ChannelJoinRequest;
        const channelMap = {...(state[request.channel_id] ?? {})};
        if (request.status === 'pending') {
            channelMap[request.id] = request;
        } else {
            delete channelMap[request.id];
        }
        return {
            ...state,
            [request.channel_id]: channelMap,
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function pendingCounts(state: ChannelJoinRequestsState['pendingCounts'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelJoinRequestTypes.RECEIVED_PENDING_JOIN_REQUESTS_COUNT: {
        const {channelId, count} = action.data as {channelId: string; count: number};
        return {
            ...state,
            [channelId]: count,
        };
    }

    case ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST: {
        // Adjust the count optimistically so the admin badge tracks the
        // queue without an extra round trip after each event.
        const request = action.data as ChannelJoinRequest;
        const current = state[request.channel_id] ?? 0;
        if (request.status === 'pending') {
            // If we already know about this request the count shouldn't change,
            // but we don't have that map available here. Recomputation happens
            // from the next RECEIVED_PENDING_JOIN_REQUESTS_COUNT.
            return {...state, [request.channel_id]: current + 1};
        }
        if (current > 0) {
            return {...state, [request.channel_id]: current - 1};
        }
        return state;
    }

    case ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUESTS: {
        // When we receive the authoritative list, trust its length when no
        // explicit count was sent alongside.
        const {channelId, requests, total} = action.data as {
            channelId: string;
            requests: ChannelJoinRequest[];
            total?: number;
        };
        if (typeof total === 'number') {
            return {...state, [channelId]: total};
        }
        const pendingTotal = requests.filter((r) => r.status === 'pending').length;
        return {...state, [channelId]: pendingTotal};
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    pendingByMe,
    pendingByChannel,
    pendingCounts,
});
