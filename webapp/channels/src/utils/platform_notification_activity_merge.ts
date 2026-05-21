// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

const THREAD_NOTIFICATION_ID_PREFIX = 'thread:';
const DIRECT_MESSAGE_NOTIFICATION_ID_PREFIX = 'dm:';

export function getThreadRootId(record: PlatformNotificationRecord): string | undefined {
    if (record.threadRootId) {
        return record.threadRootId;
    }

    if (record.id.startsWith(THREAD_NOTIFICATION_ID_PREFIX)) {
        return record.id.slice(THREAD_NOTIFICATION_ID_PREFIX.length);
    }

    return undefined;
}

export function getThreadReplyGroupKey(record: PlatformNotificationRecord): string | null {
    if (!record.isThreadReply) {
        return null;
    }

    const threadRootId = getThreadRootId(record);
    return threadRootId || null;
}

export function getThreadNotificationId(threadRootId: string): string {
    return `${THREAD_NOTIFICATION_ID_PREFIX}${threadRootId}`;
}

export function getDirectMessageNotificationId(channelId: string): string {
    return `${DIRECT_MESSAGE_NOTIFICATION_ID_PREFIX}${channelId}`;
}

export function getDirectMessageGroupKey(record: PlatformNotificationRecord): string | null {
    if (!record.isDirectMessage) {
        return null;
    }

    return record.channelId || null;
}

export function getPlatformNotificationGroupKey(record: PlatformNotificationRecord): string | null {
    return getThreadReplyGroupKey(record) || getDirectMessageGroupKey(record);
}

export function mergeParticipantUserIds(
    existing: string[] | undefined,
    ...incoming: Array<string | undefined>
): string[] {
    const ids = [...(existing || [])];

    for (const userId of incoming) {
        if (userId && !ids.includes(userId)) {
            ids.push(userId);
        }
    }

    return ids;
}

export function mergeThreadReplyIntoRecord(
    existing: PlatformNotificationRecord,
    incoming: PlatformNotificationRecord,
): PlatformNotificationRecord {
    const replyCount = (existing.replyCount || 1) + 1;
    const useIncoming = incoming.recordedAt >= existing.recordedAt;
    const participantUserIds = mergeParticipantUserIds(
        existing.participantUserIds,
        existing.senderUserId,
        incoming.senderUserId,
    );

    return {
        ...existing,
        id: getThreadNotificationId(getThreadRootId(existing) || getThreadRootId(incoming) || existing.id),
        ...(useIncoming ? {
            postId: incoming.postId,
            previewBody: incoming.previewBody,
            recordedAt: incoming.recordedAt,
            permalinkUrl: incoming.permalinkUrl,
            senderUserId: incoming.senderUserId,
            readAt: undefined,
        } : {}),
        replyCount,
        participantUserIds,
    };
}

export function mergeDirectMessageIntoRecord(
    existing: PlatformNotificationRecord,
    incoming: PlatformNotificationRecord,
): PlatformNotificationRecord {
    const messageCount = (existing.replyCount || 1) + 1;
    const useIncoming = incoming.recordedAt >= existing.recordedAt;
    const channelId = existing.channelId || incoming.channelId;

    return {
        ...existing,
        id: getDirectMessageNotificationId(channelId),
        ...(useIncoming ? {
            postId: incoming.postId,
            previewBody: incoming.previewBody,
            recordedAt: incoming.recordedAt,
            permalinkUrl: incoming.permalinkUrl,
            senderUserId: incoming.senderUserId,
            readAt: undefined,
        } : {}),
        replyCount: messageCount,
        isDirectMessage: true,
    };
}

export function mergeGroupedPlatformNotification(
    existing: PlatformNotificationRecord,
    incoming: PlatformNotificationRecord,
): PlatformNotificationRecord {
    if (getThreadReplyGroupKey(existing)) {
        return mergeThreadReplyIntoRecord(existing, incoming);
    }

    if (getDirectMessageGroupKey(existing)) {
        return mergeDirectMessageIntoRecord(existing, incoming);
    }

    return incoming;
}

export function consolidateThreadReplyNotifications(
    notifications: PlatformNotificationRecord[],
): PlatformNotificationRecord[] {
    const nonThreadReplies: PlatformNotificationRecord[] = [];
    const groups = new Map<string, PlatformNotificationRecord>();

    const sorted = [...notifications].sort((a, b) => a.recordedAt - b.recordedAt);

    for (const record of sorted) {
        const key = getPlatformNotificationGroupKey(record);
        if (!key) {
            nonThreadReplies.push(record);
            continue;
        }

        const normalizedRecord: PlatformNotificationRecord = {
            ...record,
            replyCount: record.replyCount || 1,
            participantUserIds: record.participantUserIds ||
                (record.senderUserId ? [record.senderUserId] : []),
        };

        if (getDirectMessageGroupKey(record)) {
            normalizedRecord.id = getDirectMessageNotificationId(record.channelId);
        } else if (getThreadReplyGroupKey(record)) {
            normalizedRecord.id = getThreadNotificationId(getThreadRootId(record) || record.id);
        }

        const existing = groups.get(key);
        if (existing) {
            groups.set(key, mergeGroupedPlatformNotification(existing, normalizedRecord));
        } else {
            groups.set(key, normalizedRecord);
        }
    }

    return [...groups.values(), ...nonThreadReplies].
        sort((a, b) => b.recordedAt - a.recordedAt);
}

export function enrichPlatformNotificationRecords(
    state: GlobalState,
    notifications: PlatformNotificationRecord[],
): PlatformNotificationRecord[] {
    return notifications.map((record) => {
        if (!record.isThreadReply) {
            return record;
        }

        const threadRootIdFromId = getThreadRootId(record);
        if (threadRootIdFromId) {
            return {
                ...record,
                threadRootId: threadRootIdFromId,
                id: getThreadNotificationId(threadRootIdFromId),
            };
        }

        const post = getPost(state, record.postId);
        if (!post?.root_id) {
            return record;
        }

        return {
            ...record,
            threadRootId: post.root_id,
            id: getThreadNotificationId(post.root_id),
        };
    });
}
