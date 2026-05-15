// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    ChannelJoinRequest,
    ChannelJoinRequestStatus,
    GetChannelJoinRequestsOptions,
} from '@mattermost/types/channels';

import {ChannelJoinRequestTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';

// Submits a request to join a discoverable private channel. When the channel
// has an ABAC policy that the user satisfies, the server adds the membership
// directly and returns {status: 'approved'} — callers should treat that as a
// no-pending-request signal and refetch the membership/channel as needed.
export function requestJoinChannel(channelId: string, message?: string): ActionFuncAsync<ChannelJoinRequest | {status: ChannelJoinRequestStatus}> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.requestJoinChannel(channelId, message);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        // The /channels/{id}/join_request endpoint returns either a full
        // request row or a {status: approved} stub for the ABAC fast path.
        // Only the former should be stored as the user's pending request.
        if ((data as ChannelJoinRequest)?.id) {
            const request = data as ChannelJoinRequest;
            dispatch({
                type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
                data: {channelId: request.channel_id, request},
            });
            dispatch({
                type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
                data: request,
            });
        } else {
            dispatch({
                type: ChannelJoinRequestTypes.CLEARED_MY_CHANNEL_JOIN_REQUEST,
                data: {channelId},
            });
        }

        return {data};
    };
}

// Withdraws the current user's pending request for a channel. Clears the
// per-channel slot regardless of the server response shape, but only if the
// call succeeded — leaving the optimistic state alone on error.
export function withdrawChannelJoinRequest(channelId: string): ActionFuncAsync<ChannelJoinRequest> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.withdrawChannelJoinRequest(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.CLEARED_MY_CHANNEL_JOIN_REQUEST,
            data: {channelId},
        });
        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
            data,
        });

        return {data};
    };
}

// Loads the calling user's pending request for a single channel. 404 from the
// server is treated as "no pending request" rather than a transport error.
export function getMyChannelJoinRequest(channelId: string): ActionFuncAsync<ChannelJoinRequest | null> {
    return async (dispatch, getState) => {
        let data: ChannelJoinRequest | null = null;
        try {
            data = await Client4.getMyChannelJoinRequest(channelId);
        } catch (error: any) {
            if (error?.status_code === 404) {
                dispatch({
                    type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
                    data: {channelId, request: null},
                });
                return {data: null};
            }
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUEST,
            data: {channelId, request: data},
        });
        return {data};
    };
}

export function getMyChannelJoinRequests(opts: GetChannelJoinRequestsOptions = {}): ActionFuncAsync<ChannelJoinRequest[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getMyChannelJoinRequests({status: 'pending', ...opts});
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_MY_CHANNEL_JOIN_REQUESTS,
            data: {requests: data.requests},
        });
        return {data: data.requests};
    };
}

export function getChannelJoinRequests(channelId: string, opts: GetChannelJoinRequestsOptions = {}): ActionFuncAsync<ChannelJoinRequest[]> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannelJoinRequests(channelId, {status: 'pending', ...opts});
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUESTS,
            data: {channelId, requests: data.requests, total: data.total_count},
        });
        return {data: data.requests};
    };
}

export function patchChannelJoinRequest(
    channelId: string,
    requestId: string,
    patch: {status: ChannelJoinRequestStatus; denial_reason?: string},
): ActionFuncAsync<ChannelJoinRequest> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.patchChannelJoinRequest(channelId, requestId, patch);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_CHANNEL_JOIN_REQUEST,
            data,
        });
        return {data};
    };
}

export function countPendingChannelJoinRequests(channelId: string): ActionFuncAsync<number> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.countPendingChannelJoinRequests(channelId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ChannelJoinRequestTypes.RECEIVED_PENDING_JOIN_REQUESTS_COUNT,
            data: {channelId, count: data.count},
        });
        return {data: data.count};
    };
}
