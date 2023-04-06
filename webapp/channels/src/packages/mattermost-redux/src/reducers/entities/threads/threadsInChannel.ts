// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, PostTypes, TeamTypes, ThreadTypes, UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Channel} from '@mattermost/types/channels';
import type {ThreadsState} from '@mattermost/types/threads';
import {handlePostRemoved, handleReceivedThread, handleReceiveThreads} from './utils';

import type {ExtraData} from './types';

type State = ThreadsState['threadsInChannel'];

function handleLeaveChannel(state: State, action: GenericAction) {
    const channel: Channel = action.data;

    if (!state[channel.id]) {
        return state;
    }

    const nextState = {...state};
    Reflect.deleteProperty(nextState, channel.id);

    return nextState;
}

export function threadsInChannelReducer(state: State = {}, action: GenericAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.RECEIVED_THREAD: {
        const {thread} = action.data;
        return handleReceivedThread<State>(state, thread, thread.post.channel_id, extra);
    }
    case PostTypes.POST_REMOVED:
        return handlePostRemoved(state, action);
    case ChannelTypes.RECEIVED_CHANNEL_THREADS:
        return handleReceiveThreads(state, action, action.data.channel_id);
    case TeamTypes.LEAVE_TEAM:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel(state, action);
    }

    return state;
}
