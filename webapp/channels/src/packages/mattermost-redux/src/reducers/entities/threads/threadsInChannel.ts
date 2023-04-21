// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, PostTypes, TeamTypes, ThreadTypes, UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Channel} from '@mattermost/types/channels';
import type {ThreadsState, UserThread} from '@mattermost/types/threads';
import type {RelationOneToMany} from '@mattermost/types/utilities';

import {handleFollowChanged, handlePostRemoved, handleReceivedThread, handleReceiveThreads} from './utils';

import type {ExtraData} from './types';

function handleLeaveChannel<S extends RelationOneToMany<Channel, UserThread>>(state: S, action: GenericAction): S {
    const channel: Channel = action.data;

    if (!state[channel.id]) {
        return state;
    }

    const nextState = {...state};
    Reflect.deleteProperty(nextState, channel.id);

    return nextState;
}

export function threadsInChannelReducer(state: ThreadsState['threadsInChannel'] = {}, action: GenericAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.RECEIVED_THREAD: {
        const {thread} = action.data;
        return handleReceivedThread<ThreadsState['threadsInChannel']>(state, thread, thread.post.channel_id, extra);
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
        return handleLeaveChannel<ThreadsState['threadsInChannel']>(state, action);
    }

    return state;
}

export function followingThreadsInChannelReducer(state: ThreadsState['followingThreadsInChannel'] = {}, action: GenericAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.RECEIVED_THREAD: {
        const {thread} = action.data;
        if (!thread.is_following) {
            return state;
        }
        return handleReceivedThread<ThreadsState['followingThreadsInChannel']>(state, thread, thread.post.channel_id, extra);
    }
    case PostTypes.POST_REMOVED:
        return handlePostRemoved(state, action);
    case ChannelTypes.RECEIVED_FOLLOWING_CHANNEL_THREADS:
        return handleReceiveThreads(state, action, action.data.channel_id);
    case TeamTypes.LEAVE_TEAM:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel<ThreadsState['followingThreadsInChannel']>(state, action);
    case ThreadTypes.FOLLOW_CHANGED_THREAD:
        return handleFollowChanged<ThreadsState['followingThreadsInChannel']>(state, action, action.data.channel_id, extra);
    }

    return state;
}

export function userThreadsInChannelReducer(state: ThreadsState['userThreadsInChannel'] = {}, action: GenericAction, extra: ExtraData) {
    switch (action.type) {
    case ThreadTypes.RECEIVED_THREAD: {
        const {thread, currentUserId} = action.data;
        if (thread.post.user_id !== currentUserId) {
            return state;
        }
        return handleReceivedThread<ThreadsState['userThreadsInChannel']>(state, thread, thread.post.channel_id, extra);
    }
    case PostTypes.POST_REMOVED:
        return handlePostRemoved(state, action);
    case ChannelTypes.RECEIVED_CREATED_CHANNEL_THREADS:
        return handleReceiveThreads(state, action, action.data.channel_id);
    case TeamTypes.LEAVE_TEAM:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    case ChannelTypes.RECEIVED_CHANNEL_DELETED:
    case ChannelTypes.LEAVE_CHANNEL:
        return handleLeaveChannel<ThreadsState['userThreadsInChannel']>(state, action);
    }

    return state;
}
