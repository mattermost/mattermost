// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';
import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {ActionTypes} from 'utils/constants';

export type ReceivedReaction = {
    user_id: string;
    post_id: string;
    emoji_name: string;
    create_at: number;
    channel_id: string;
    post_message: string;
    post_author_id: string;
};

// Track distinct post IDs that have unread activity. Multiple reactions on the
// same post (or repeated mentions) only count once.
function unreadPostIds(state: string[] = [], action: AnyAction): string[] {
    switch (action.type) {
    case ActionTypes.ACTIVITY_RECEIVED: {
        const id = action.data?.post_id;
        if (!id || state.includes(id)) {
            return state;
        }
        return [...state, id];
    }
    case ActionTypes.ACTIVITY_MENTION_RECEIVED: {
        const id = action.data?.id;
        if (!id || state.includes(id)) {
            return state;
        }
        return [...state, id];
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
