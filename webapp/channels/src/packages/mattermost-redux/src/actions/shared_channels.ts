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

export function fetchChannelRemoteNames(channelId: string): ActionFuncAsync<RemoteClusterInfo[]> {
    return async (dispatch: any, getState: () => GlobalState) => {
        // Check if we already have the data in the Redux store
        const state = getState();
        const remotes = state.entities?.sharedChannels?.remotes?.[channelId];

        // If we already have the data, no need to fetch it again
        if (remotes && remotes.length > 0) {
            return {data: remotes};
        }

        let data;
        try {
            data = await Client4.getSharedChannelRemoteInfo(channelId);
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
