// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

import type {SharedChannelWithRemotes} from '@mattermost/types/shared_channels';

export const ActionTypes = {
    RECEIVED_SHARED_CHANNELS_WITH_REMOTES: 'RECEIVED_SHARED_CHANNELS_WITH_REMOTES',
    RECEIVED_CHANNEL_REMOTE_NAMES: 'RECEIVED_CHANNEL_REMOTE_NAMES',
};

export function sharedChannelsWithRemotes(state: Record<string, SharedChannelWithRemotes> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_SHARED_CHANNELS_WITH_REMOTES: {
        const nextState = {...state};
        for (const scwr of action.data) {
            nextState[scwr.shared_channel.channel_id] = scwr;
        }
        return nextState;
    }
    default:
        return state;
    }
}

export function remoteNames(state: Record<string, string[]> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_CHANNEL_REMOTE_NAMES: {
        const {channelId, remoteNames} = action.data;
        return {
            ...state,
            [channelId]: remoteNames,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    sharedChannelsWithRemotes,
    remoteNames,
});
