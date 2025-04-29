// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {SharedChannelWithRemotes} from 'mattermost-redux/types/shared_channels';

export function sharedChannelsWithRemotes(state: Record<string, SharedChannelWithRemotes> = {}, action: GenericAction) {
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

export default combineReducers({
    sharedChannelsWithRemotes,
});
