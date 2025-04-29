// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

export const ActionTypes = {
    RECEIVED_CHANNEL_REMOTE_NAMES: 'RECEIVED_CHANNEL_REMOTE_NAMES',
};

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
    remoteNames,
});
