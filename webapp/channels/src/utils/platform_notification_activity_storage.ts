// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlatformNotification} from '@mattermost/types/platform_notifications';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getConnectionId} from 'selectors/general';

import {PLATFORM_NOTIFICATION_ACTIVITY_MAX, StoragePrefixes} from 'utils/constants';
import LocalStorageStore from 'stores/local_storage_store';

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

function getStorageKey(userId: string): string {
    return `${StoragePrefixes.PLATFORM_NOTIFICATION_ACTIVITY}${userId}`;
}

function isValidPlatformNotificationRecord(v: unknown): v is PlatformNotificationRecord {
    if (!v || typeof v !== 'object') {
        return false;
    }
    const o = v as Record<string, unknown>;
    return typeof o.id === 'string' &&
        typeof o.recordedAt === 'number' &&
        typeof o.postId === 'string' &&
        typeof o.channelId === 'string' &&
        typeof o.teamId === 'string' &&
        typeof o.channelDisplayName === 'string' &&
        typeof o.contextLabel === 'string' &&
        typeof o.permalinkUrl === 'string' &&
        typeof o.isThreadReply === 'boolean' &&
        typeof o.previewBody === 'string';
}

export function readPlatformNotificationActivityFromStorage(state: GlobalState, userId: string): PlatformNotificationRecord[] {
    const raw = LocalStorageStore.getItem(getStorageKey(userId), state);
    if (!raw || raw === 'null') {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(isValidPlatformNotificationRecord).slice(0, PLATFORM_NOTIFICATION_ACTIVITY_MAX);
    } catch {
        return [];
    }
}

export function clearPlatformNotificationActivityStorage(state: GlobalState, userId: string): void {
    LocalStorageStore.removeItem(getStorageKey(userId), state);
}

export function fromServerPlatformNotification(notification: PlatformNotification): PlatformNotificationRecord {
    return {
        id: notification.id,
        recordedAt: notification.recorded_at,
        postId: notification.post_id,
        channelId: notification.channel_id,
        teamId: notification.team_id,
        channelDisplayName: notification.channel_display_name,
        contextLabel: notification.context_label,
        permalinkUrl: notification.permalink_url,
        isThreadReply: notification.is_thread_reply,
        isMention: notification.is_mention,
        isDirectMessage: notification.is_direct_message,
        senderUserId: notification.sender_user_id,
        threadRootId: notification.thread_root_id,
        replyCount: notification.reply_count,
        participantUserIds: notification.participant_user_ids,
        readAt: notification.read_at,
        previewBody: notification.preview_body,
    };
}

export function toServerPlatformNotification(record: PlatformNotificationRecord, userId: string): PlatformNotification {
    return {
        id: record.id,
        user_id: userId,
        post_id: record.postId,
        channel_id: record.channelId,
        team_id: record.teamId,
        recorded_at: record.recordedAt,
        read_at: record.readAt,
        channel_display_name: record.channelDisplayName,
        context_label: record.contextLabel,
        permalink_url: record.permalinkUrl,
        is_thread_reply: record.isThreadReply,
        is_mention: record.isMention,
        is_direct_message: record.isDirectMessage,
        sender_user_id: record.senderUserId,
        thread_root_id: record.threadRootId,
        reply_count: record.replyCount,
        participant_user_ids: record.participantUserIds,
        preview_body: record.previewBody,
    };
}

export async function fetchPlatformNotificationsFromServer(userId: string): Promise<PlatformNotificationRecord[]> {
    const notifications = await Client4.getPlatformNotifications(userId);
    if (!notifications) {
        return [];
    }
    return notifications.map(fromServerPlatformNotification);
}

export async function upsertPlatformNotificationOnServer(state: GlobalState, record: PlatformNotificationRecord): Promise<void> {
    const userId = getCurrentUserId(state);
    if (!userId) {
        return;
    }

    const connectionId = getConnectionId(state);
    await Client4.upsertPlatformNotification(toServerPlatformNotification(record, userId), connectionId);
}

export async function replacePlatformNotificationsOnServer(state: GlobalState, records: PlatformNotificationRecord[]): Promise<void> {
    const userId = getCurrentUserId(state);
    if (!userId) {
        return;
    }

    const connectionId = getConnectionId(state);
    const payload = records.slice(0, PLATFORM_NOTIFICATION_ACTIVITY_MAX).map((record) => toServerPlatformNotification(record, userId));
    await Client4.replacePlatformNotifications(payload, connectionId, userId);
}

export async function deletePlatformNotificationOnServer(state: GlobalState, recordId: string): Promise<void> {
    const userId = getCurrentUserId(state);
    if (!userId) {
        return;
    }

    const connectionId = getConnectionId(state);
    await Client4.deletePlatformNotification(recordId, connectionId, userId);
}

export async function clearPlatformNotificationsOnServer(state: GlobalState): Promise<void> {
    const userId = getCurrentUserId(state);
    if (!userId) {
        return;
    }

    const connectionId = getConnectionId(state);
    await Client4.clearPlatformNotifications(connectionId, userId);
}

export async function migrateLocalPlatformNotificationsToServer(state: GlobalState, userId: string): Promise<PlatformNotificationRecord[]> {
    const localRecords = readPlatformNotificationActivityFromStorage(state, userId);
    if (localRecords.length === 0) {
        return [];
    }

    await replacePlatformNotificationsOnServer(state, localRecords);
    clearPlatformNotificationActivityStorage(state, userId);
    return localRecords;
}

export function syncPlatformNotificationActivityToStorage(_state: GlobalState): void {
    // Deprecated: notifications are persisted on the server.
}

export async function syncPlatformNotificationActivityToServer(state: GlobalState, records: PlatformNotificationRecord[]): Promise<void> {
    await replacePlatformNotificationsOnServer(state, records);
}
