// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {DiscordReplyData} from 'reducers/views/discord_replies';

function isChannelSpecificReplies(state: GlobalState): boolean {
    return get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_SPECIFIC_REPLIES, Preferences.CHANNEL_SPECIFIC_REPLIES_DEFAULT) === 'true';
}

/**
 * Gets all pending Discord replies.
 */
export function getPendingReplies(state: GlobalState): DiscordReplyData[] {
    if (isChannelSpecificReplies(state)) {
        const channelId = getCurrentChannelId(state);
        return state.views.discordReplies?.channelPendingReplies?.[channelId] ?? [];
    }
    return state.views.discordReplies?.pendingReplies ?? [];
}

/**
 * Checks if there are any pending replies.
 */
export function hasPendingReplies(state: GlobalState): boolean {
    return getPendingReplies(state).length > 0;
}

/**
 * Gets the count of pending replies.
 */
export function getPendingRepliesCount(state: GlobalState): number {
    return getPendingReplies(state).length;
}

/**
 * Checks if a specific post is in the pending replies queue.
 */
export function isPostPendingReply(state: GlobalState, postId: string): boolean {
    return getPendingReplies(state).some((r) => r.post_id === postId);
}
