// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getMyChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getThread} from 'mattermost-redux/selectors/entities/threads';

import {getThreadRootId} from 'utils/platform_notification_activity_merge';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

function getPostActivityTimestamp(post: {create_at: number; edit_at?: number; update_at?: number}): number {
    return Math.max(post.create_at, post.edit_at || 0, post.update_at || 0);
}

export function isPlatformNotificationMarkedRead(record: PlatformNotificationRecord): boolean {
    return Boolean(record.readAt && record.recordedAt <= record.readAt);
}

export function isPlatformNotificationUnread(state: GlobalState, record: PlatformNotificationRecord): boolean {
    if (isPlatformNotificationMarkedRead(record)) {
        return false;
    }

    if (record.isThreadReply) {
        const threadRootId = getThreadRootId(record);
        if (threadRootId) {
            const thread = getThread(state, threadRootId);
            if (thread) {
                return Boolean(thread.unread_replies || thread.unread_mentions);
            }
        }

        return false;
    }

    const post = getPost(state, record.postId);
    const membership = getMyChannelMembership(state, record.channelId);
    if (post && membership) {
        return getPostActivityTimestamp(post) > membership.last_viewed_at;
    }

    return false;
}
