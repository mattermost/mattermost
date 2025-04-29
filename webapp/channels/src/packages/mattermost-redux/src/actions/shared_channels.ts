// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {SharedChannelWithRemotes} from '@mattermost/types/shared_channels';
import type {GlobalState} from '@mattermost/types/store';

import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {ActionTypes} from '../reducers/entities/shared_channels';

// Declare the methods directly on the Client4 instance
// These methods already exist in the implementation, we're just adding TypeScript definitions here
declare module '@mattermost/client' {
    interface Client4 {
        getSharedChannels(teamId: string, page?: number, perPage?: number): Promise<SharedChannelWithRemotes[]>;
        getSharedChannelRemoteNames(channelId: string): Promise<string[]>;
    }
}

export function receivedSharedChannelsWithRemotes(sharedChannelsWithRemotes: any[]) {
    return {
        type: ActionTypes.RECEIVED_SHARED_CHANNELS_WITH_REMOTES,
        data: sharedChannelsWithRemotes,
    };
}

export function receivedChannelRemoteNames(channelId: string, remoteNames: string[]) {
    return {
        type: ActionTypes.RECEIVED_CHANNEL_REMOTE_NAMES,
        data: {
            channelId,
            remoteNames,
        },
    };
}

export function fetchSharedChannelsWithRemotes(teamId: string, page = 0, perPage = 50): ActionFuncAsync {
    return async (dispatch: any) => {
        let data;
        try {
            data = await Client4.getSharedChannels(teamId, page, perPage);
        } catch (error) {
            // In case of failures, we just skip and don't update the shared channels
            return {error};
        }

        if (data) {
            dispatch(receivedSharedChannelsWithRemotes(data));
        }

        return {data};
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
