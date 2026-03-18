// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {getAllChannelStats} from 'mattermost-redux/selectors/entities/channels';

export interface BurnOnReadRecipientData {
    revealedCount: number;
    totalRecipients: number;
}

/**
 * Calculates recipient data for burn-on-read posts.
 * Only available to the post author for tracking who has revealed the message.
 */
export function getBurnOnReadRecipientData(state: GlobalState, post: Post | null, currentUserId: string): BurnOnReadRecipientData | null {
    if (!post || post.user_id !== currentUserId) {
        return null;
    }

    const channelStats = getAllChannelStats(state);
    const stats = channelStats[post.channel_id];

    if (!stats) {
        return null;
    }

    const revealedCount = post.metadata?.recipients?.length || 0;

    // Note: Assumes author is still in channel (subtracts 1 from member count to exclude author).
    // Edge case: If author leaves after creating post, count will be incorrect.
    // This doesn't affect UX since only authors see receipts and they can't view the channel after leaving.
    // If read receipts become visible to non-authors, consider storing recipient count at creation time.
    const totalRecipients = Math.max(0, stats.member_count - 1);

    return {
        revealedCount,
        totalRecipients,
    };
}
