// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

export function getSharedChannels(): GenericAction {
    return {
        type: ActionTypes.GET_SHARED_CHANNELS,
    };
}

export function receivedSharedChannelsWithRemotes(sharedChannelsWithRemotes: any[]): GenericAction {
    return {
        type: ActionTypes.RECEIVED_SHARED_CHANNELS_WITH_REMOTES,
        data: sharedChannelsWithRemotes,
    };
}
