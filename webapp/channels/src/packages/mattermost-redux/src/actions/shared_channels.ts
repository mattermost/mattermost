// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';
import type {GlobalState} from '@mattermost/types/store';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {ActionTypes} from '../reducers/entities/shared_channels';

export function receivedChannelRemotes(channelId: string, remotes: RemoteClusterInfo[]) {
    return {
        type: ActionTypes.RECEIVED_CHANNEL_REMOTES,
        data: {
            channelId,
            remotes,
        },
    };
}

export function receivedRemoteClusterInfo(remoteId: string, remoteInfo: RemoteClusterInfo) {
    return {
        type: ActionTypes.RECEIVED_REMOTE_CLUSTER_INFO,
        data: {
            remoteId,
            remoteInfo,
        },
    };
}

export function fetchChannelRemotes(channelId: string, forceRefresh = false): ActionFuncAsync<RemoteClusterInfo[]> {
    return async (dispatch: any, getState: () => GlobalState) => {
        // Check if we already have the data in the Redux store
        const state = getState();
        const remotes = state.entities?.sharedChannels?.remotes?.[channelId];

        // If we already have the data and no refresh is requested, use the cached data
        if (!forceRefresh && remotes && remotes.length > 0) {
            return {data: remotes};
        }

        let data;
        try {
            data = await Client4.getSharedChannelRemoteInfos(channelId);
        } catch (error) {
            // In case of failures, we just skip and don't update the remote data
            return {error};
        }

        if (data) {
            dispatch(receivedChannelRemotes(channelId, data));
        }

        return {data};
    };
}

export function fetchRemoteClusterInfo(remoteId: string, forceRefresh = false): ActionFuncAsync<RemoteClusterInfo> {
    return async (dispatch: any, getState: () => GlobalState) => {
        // Check if we already have the remote info cached
        const state = getState();
        const cachedRemote = state.entities?.sharedChannels?.remotesByRemoteId?.[remoteId];

        if (!forceRefresh && cachedRemote) {
            return {data: cachedRemote};
        }

        let data;
        try {
            data = await Client4.getRemoteClusterInfo(remoteId);
        } catch (error) {
            return {error};
        }

        if (data) {
            dispatch(receivedRemoteClusterInfo(remoteId, data));
        }

        return {data};
    };
}
