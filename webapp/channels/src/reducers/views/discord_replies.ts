// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

export interface DiscordReplyData {
    post_id: string;
    user_id: string;
    username: string;
    nickname: string;
    text: string;
    has_image: boolean;
    has_video: boolean;
}

export interface DiscordRepliesState {
    // Array of pending replies waiting to be sent
    pendingReplies: DiscordReplyData[];
}

function pendingReplies(state: DiscordReplyData[] = [], action: MMAction): DiscordReplyData[] {
    switch (action.type) {
    case ActionTypes.DISCORD_REPLY_ADD_PENDING: {
        const reply = action.reply as DiscordReplyData;

        // Check if already in queue (toggle behavior - remove if exists)
        const existingIndex = state.findIndex((r) => r.post_id === reply.post_id);
        if (existingIndex >= 0) {
            return state.filter((r) => r.post_id !== reply.post_id);
        }

        // Max 10 replies
        if (state.length >= 10) {
            return state;
        }

        return [...state, reply];
    }
    case ActionTypes.DISCORD_REPLY_REMOVE_PENDING: {
        const postId = action.postId as string;
        return state.filter((r) => r.post_id !== postId);
    }
    case ActionTypes.DISCORD_REPLY_CLEAR_PENDING:
    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}

export default combineReducers({
    pendingReplies,
});
