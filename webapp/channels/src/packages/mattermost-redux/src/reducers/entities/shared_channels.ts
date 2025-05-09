// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

export const ActionTypes = {
    RECEIVED_CHANNEL_REMOTES: 'RECEIVED_CHANNEL_REMOTES',
};

export function remotes(state: Record<string, RemoteClusterInfo[]> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_CHANNEL_REMOTES: {
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

export default combineReducers({
    remotes,
});
