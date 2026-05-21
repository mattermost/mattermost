// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {isDirectChannel, isGroupChannel} from 'mattermost-redux/utils/channel_utils';

import {PLATFORM_NOTIFICATION_BURST_WINDOW_MS} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

const THREAD_NOTIFICATION_ID_PREFIX = 'thread:';
const DIRECT_MESSAGE_NOTIFICATION_ID_PREFIX = 'dm:';

export function getThreadRootId(record: PlatformNotificationRecord): string | undefined {
    if (record.threadRootId) {
        return record.threadRootId;
    }

    if (record.id?.startsWith(THREAD_NOTIFICATION_ID_PREFIX)) {
        const rest = record.id.slice(THREAD_NOTIFICATION_ID_PREFIX.length);
        const separatorIndex = rest.indexOf(':');
        return separatorIndex >= 0 ? rest.slice(0, separatorIndex) : rest;
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

export function getDirectMessageGroupKey(record: PlatformNotificationRecord): string | null {
    return getPrivateMessageGroupKey(record);
}

export function getPrivateMessageGroupKey(record: PlatformNotificationRecord): string | null {
    if (record.isThreadReply) {
        return null;
    }

    if (!record.isDirectMessage && !record.isGroupMessage) {
        return null;
    }

    return record.channelId || null;
}

export function getPlatformNotificationGroupKey(record: PlatformNotificationRecord): string | null {
    return getPlatformNotificationContextKey(record);
}

export function getPlatformNotificationContextKey(record: PlatformNotificationRecord): string | null {
    return getThreadReplyGroupKey(record) || getPrivateMessageGroupKey(record);
}

export function getThreadNotificationId(threadRootId: string, burstAnchorRecordedAt?: number): string {
    if (burstAnchorRecordedAt) {
        return `${THREAD_NOTIFICATION_ID_PREFIX}${threadRootId}:${burstAnchorRecordedAt}`;
    }

    return `${THREAD_NOTIFICATION_ID_PREFIX}${threadRootId}`;
}

export function getDirectMessageNotificationId(channelId: string, burstAnchorRecordedAt?: number): string {
    if (burstAnchorRecordedAt) {
        return `${DIRECT_MESSAGE_NOTIFICATION_ID_PREFIX}${channelId}:${burstAnchorRecordedAt}`;
    }

    return `${DIRECT_MESSAGE_NOTIFICATION_ID_PREFIX}${channelId}`;
}

export function isWithinNotificationBurstWindow(
    earlierRecordedAt: number,
    laterRecordedAt: number,
    burstWindowMs: number = PLATFORM_NOTIFICATION_BURST_WINDOW_MS,
): boolean {
    return laterRecordedAt >= earlierRecordedAt &&
        (laterRecordedAt - earlierRecordedAt) <= burstWindowMs;
}

export function sortPlatformNotificationsByRecency(
    notifications: PlatformNotificationRecord[],
): PlatformNotificationRecord[] {
    return [...notifications].sort((a, b) => b.recordedAt - a.recordedAt);
}

export function createBurstNotificationId(record: PlatformNotificationRecord): string {
    const threadRootId = getThreadRootId(record);
    if (record.isThreadReply && threadRootId) {
        return getThreadNotificationId(threadRootId, record.recordedAt);
    }

    const privateMessageKey = getPrivateMessageGroupKey(record);
    if (privateMessageKey) {
        return getDirectMessageNotificationId(privateMessageKey, record.recordedAt);
    }

    return record.id || `${record.postId}:${record.recordedAt}`;
}

export function findBurstMergeTarget(
    notifications: PlatformNotificationRecord[] | null | undefined,
    incoming: PlatformNotificationRecord,
    burstWindowMs: number = PLATFORM_NOTIFICATION_BURST_WINDOW_MS,
): PlatformNotificationRecord | null {
    const contextKey = getPlatformNotificationContextKey(incoming);
    if (!contextKey || !Array.isArray(notifications)) {
        return null;
    }

    let mergeTarget: PlatformNotificationRecord | null = null;

    for (const candidate of notifications) {
        if (getPlatformNotificationContextKey(candidate) !== contextKey) {
            continue;
        }

        if (!isWithinNotificationBurstWindow(candidate.recordedAt, incoming.recordedAt, burstWindowMs)) {
            continue;
        }

        if (!mergeTarget || candidate.recordedAt > mergeTarget.recordedAt) {
            mergeTarget = candidate;
        }
    }

    return mergeTarget;
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
    const latestRecordedAt = Math.max(existing.recordedAt, incoming.recordedAt);
    const useIncoming = incoming.recordedAt >= existing.recordedAt;
    const participantUserIds = mergeParticipantUserIds(
        existing.participantUserIds,
        existing.senderUserId,
        incoming.senderUserId,
    );

    return {
        ...existing,
        id: existing.id,
        recordedAt: latestRecordedAt,
        ...(useIncoming ? {
            postId: incoming.postId,
            previewBody: incoming.previewBody,
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
    const latestRecordedAt = Math.max(existing.recordedAt, incoming.recordedAt);
    const useIncoming = incoming.recordedAt >= existing.recordedAt;

    return {
        ...existing,
        id: existing.id,
        recordedAt: latestRecordedAt,
        ...(useIncoming ? {
            postId: incoming.postId,
            previewBody: incoming.previewBody,
            permalinkUrl: incoming.permalinkUrl,
            senderUserId: incoming.senderUserId,
            readAt: undefined,
        } : {}),
        replyCount: messageCount,
        isDirectMessage: existing.isDirectMessage ?? incoming.isDirectMessage,
        isGroupMessage: existing.isGroupMessage ?? incoming.isGroupMessage,
    };
}

export function mergeGroupedPlatformNotification(
    existing: PlatformNotificationRecord,
    incoming: PlatformNotificationRecord,
): PlatformNotificationRecord {
    if (getThreadReplyGroupKey(existing)) {
        return mergeThreadReplyIntoRecord(existing, incoming);
    }

    if (getPrivateMessageGroupKey(existing)) {
        return mergeDirectMessageIntoRecord(existing, incoming);
    }

    return incoming;
}

function normalizeGroupedRecord(record: PlatformNotificationRecord): PlatformNotificationRecord {
    return {
        ...record,
        replyCount: record.replyCount || 1,
        participantUserIds: record.participantUserIds ||
            (record.senderUserId ? [record.senderUserId] : []),
    };
}

export function consolidateThreadReplyNotifications(
    notifications: PlatformNotificationRecord[],
): PlatformNotificationRecord[] {
    const ungrouped: PlatformNotificationRecord[] = [];
    const grouped: PlatformNotificationRecord[] = [];

    const sorted = [...notifications].sort((a, b) => a.recordedAt - b.recordedAt);

    for (const record of sorted) {
        const contextKey = getPlatformNotificationContextKey(record);
        if (!contextKey) {
            ungrouped.push(record);
            continue;
        }

        const normalizedRecord = normalizeGroupedRecord(record);
        const mergeTarget = findBurstMergeTarget(grouped, normalizedRecord);
        if (mergeTarget) {
            const mergeTargetIndex = grouped.findIndex((candidate) => candidate.id === mergeTarget.id);
            grouped[mergeTargetIndex] = mergeGroupedPlatformNotification(mergeTarget, normalizedRecord);
        } else {
            grouped.push({
                ...normalizedRecord,
                id: createBurstNotificationId(normalizedRecord),
            });
        }
    }

    return sortPlatformNotificationsByRecency([...grouped, ...ungrouped]);
}

export function enrichPlatformNotificationRecords(
    state: GlobalState,
    notifications: PlatformNotificationRecord[],
): PlatformNotificationRecord[] {
    return notifications.map((record) => {
        let enriched = record;

        if (!record.isThreadReply) {
            const channel = getChannel(state, record.channelId);
            if (channel) {
                enriched = {
                    ...enriched,
                    isDirectMessage: isDirectChannel(channel),
                    isGroupMessage: isGroupChannel(channel),
                };
            }
        }

        if (!enriched.isThreadReply) {
            return enriched;
        }

        const threadRootIdFromId = getThreadRootId(enriched);
        if (threadRootIdFromId) {
            return {
                ...enriched,
                threadRootId: threadRootIdFromId,
            };
        }

        const post = getPost(state, enriched.postId);
        if (!post?.root_id) {
            return enriched;
        }

        return {
            ...enriched,
            threadRootId: post.root_id,
        };
    });
}
