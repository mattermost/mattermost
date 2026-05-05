// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {ChannelTypes, ThreadTypes} from 'mattermost-redux/action_types';

import {ActionTypes, Threads} from 'utils/constants';

export type ReceivedReaction = {
    user_id: string;
    post_id: string;
    emoji_name: string;
    create_at: number;
    channel_id: string;
    post_message: string;
    post_author_id: string;
    root_id?: string;
};

export type UnreadActivityEntry = {
    postId: string;
    channelId: string;
    rootId: string;
};

// Track distinct (post, channel) pairs that have unread activity. We carry the
// channelId alongside the postId so that when the user reads the underlying
// channel — via permalink jump, sidebar click, etc — the reducer can clear out
// matching entries and the sidebar badge decrements naturally.
function unreadPostIds(state: UnreadActivityEntry[] = [], action: AnyAction): UnreadActivityEntry[] {
    switch (action.type) {
    case ActionTypes.ACTIVITY_RECEIVED: {
        const postId = action.data?.post_id;
        const channelId = action.data?.channel_id;
        if (!postId || !channelId || state.some((e) => e.postId === postId)) {
            return state;
        }
        const rootId = action.data?.root_id ?? '';
        return [...state, {postId, channelId, rootId}];
    }
    case ActionTypes.ACTIVITY_MENTION_RECEIVED: {
        const postId = action.data?.id;
        const channelId = action.data?.channel_id;
        if (!postId || !channelId || state.some((e) => e.postId === postId)) {
            return state;
        }
        const rootId = action.data?.root_id ?? '';
        return [...state, {postId, channelId, rootId}];
    }
    case ChannelTypes.RECEIVED_LAST_VIEWED_AT: {
        // User read the channel (sidebar click, permalink, /jump-to, etc).
        // Drop any unread Activity entries that point at posts in that channel.
        const channelId = action.data?.channel_id;
        if (!channelId) {
            return state;
        }
        const filtered = state.filter((e) => e.channelId !== channelId);
        return filtered.length === state.length ? state : filtered;
    }
    case ThreadTypes.READ_CHANGED_THREAD:
    case Threads.CHANGED_LAST_VIEWED_AT: {
        // User opened/read a thread from the Threads tab or RHS. Clear any
        // Activity entries belonging to that thread — both the root post
        // (entry.postId === threadId) and any reply (entry.rootId === threadId).
        //
        // We listen to both actions because READ_CHANGED_THREAD only fires after
        // the server roundtrip echoes back (~10s on prod), while CHANGED_LAST_VIEWED_AT
        // fires synchronously on ThreadViewer mount — clearing the badge instantly.
        const threadId = action.data?.id ?? action.data?.threadId;
        if (!threadId) {
            return state;
        }
        const filtered = state.filter((e) => e.postId !== threadId && e.rootId !== threadId);
        return filtered.length === state.length ? state : filtered;
    }
    case ActionTypes.ACTIVITY_MARK_READ:
        return [];
    default:
        return state;
    }
}

function lastReceived(state: ReceivedReaction | null = null, action: AnyAction): ReceivedReaction | null {
    switch (action.type) {
    case ActionTypes.ACTIVITY_RECEIVED:
        return action.data ?? state;
    default:
        return state;
    }
}

function lastMention(state: Post | null = null, action: AnyAction): Post | null {
    switch (action.type) {
    case ActionTypes.ACTIVITY_MENTION_RECEIVED:
        return action.data ?? state;
    default:
        return state;
    }
}

export default combineReducers({
    unreadPostIds,
    lastReceived,
    lastMention,
});
