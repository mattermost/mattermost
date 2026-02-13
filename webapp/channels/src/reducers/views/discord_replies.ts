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
    file_categories: string[];
}

export interface DiscordRepliesState {
    // Array of pending replies waiting to be sent
    pendingReplies: DiscordReplyData[];

    // Record of channel-specific pending replies
    channelPendingReplies: Record<string, DiscordReplyData[]>;
}

function pendingReplies(state: DiscordReplyData[] = [], action: MMAction): DiscordReplyData[] {
    // If channelId is provided, this action is for channel-specific replies, so ignore it here
    // unless it's CLEAR_PENDING with clearAll: true
    if (action.channelId && !(action.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING && action.clearAll)) {
        return state;
    }

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

function channelPendingReplies(state: Record<string, DiscordReplyData[]> = {}, action: MMAction): Record<string, DiscordReplyData[]> {
    if (action.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING && action.clearAll) {
        return {};
    }
    if (action.type === UserTypes.LOGOUT_SUCCESS) {
        return {};
    }

    const {channelId} = action;
    if (!channelId) {
        return state;
    }

    const channelState = state[channelId] || [];

    switch (action.type) {
    case ActionTypes.DISCORD_REPLY_ADD_PENDING: {
        const reply = action.reply as DiscordReplyData;

        // Check if already in queue (toggle behavior - remove if exists)
        const existingIndex = channelState.findIndex((r) => r.post_id === reply.post_id);
        let nextChannelState;
        if (existingIndex >= 0) {
            nextChannelState = channelState.filter((r) => r.post_id !== reply.post_id);
        } else if (channelState.length >= 10) {
            nextChannelState = channelState;
        } else {
            nextChannelState = [...channelState, reply];
        }

        return {
            ...state,
            [channelId]: nextChannelState,
        };
    }
    case ActionTypes.DISCORD_REPLY_REMOVE_PENDING: {
        const postId = action.postId as string;
        return {
            ...state,
            [channelId]: channelState.filter((r) => r.post_id !== postId),
        };
    }
    case ActionTypes.DISCORD_REPLY_CLEAR_PENDING:
        return {
            ...state,
            [channelId]: [],
        };
    default:
        return state;
    }
}

export default combineReducers({
    pendingReplies,
    channelPendingReplies,
});
