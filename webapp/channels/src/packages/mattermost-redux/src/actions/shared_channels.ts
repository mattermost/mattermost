// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {ActionTypes} from '../reducers/entities/shared_channels';

export function receivedChannelRemoteNames(channelId: string, remoteNames: string[]) {
    return {
        type: ActionTypes.RECEIVED_CHANNEL_REMOTE_NAMES,
        data: {
            channelId,
            remoteNames,
        },
    };
}

export function fetchChannelRemoteNames(channelId: string): ActionFuncAsync {
    return async (dispatch: any, getState: () => GlobalState) => {
        // Check if we already have the data in the Redux store
        const state = getState();
        const remoteNames = state.entities?.sharedChannels?.remoteNames?.[channelId];

        // If we already have the data, no need to fetch it again
        if (remoteNames) {
            return {data: remoteNames};
        }

        let data;
        try {
            data = await Client4.getSharedChannelRemoteNames(channelId);
        } catch (error) {
            // In case of failures, we just skip and don't update the remote names
            return {error};
        }

        if (data) {
            dispatch(receivedChannelRemoteNames(channelId, data));
        }

        return {data};
    };
}
