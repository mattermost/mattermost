// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

import SharedChannelTypes from '../../action_types/shared_channels';

export function remotes(state: Record<string, RemoteClusterInfo[]> = {}, action: AnyAction) {
    switch (action.type) {
    case SharedChannelTypes.RECEIVED_CHANNEL_REMOTES: {
        const {channelId, remotes} = action.data;
        return {
            ...state,
            [channelId]: remotes,
        };
    }
    default:
        return state;
    }
}

export function remotesByRemoteId(state: Record<string, RemoteClusterInfo> = {}, action: AnyAction) {
    switch (action.type) {
    case SharedChannelTypes.RECEIVED_REMOTE_CLUSTER_INFO: {
        const {remoteId, remoteInfo} = action.data;
        return {
            ...state,
            [remoteId]: remoteInfo,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    remotes,
    remotesByRemoteId,
});
