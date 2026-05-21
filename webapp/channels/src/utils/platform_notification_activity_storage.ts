// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getPlatformNotifications} from 'selectors/rhs';
import LocalStorageStore from 'stores/local_storage_store';

import {PLATFORM_NOTIFICATION_ACTIVITY_MAX, StoragePrefixes} from 'utils/constants';

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

export function writePlatformNotificationActivityToStorage(state: GlobalState, notifications: PlatformNotificationRecord[]): void {
    const userId = getCurrentUserId(state);
    if (!userId) {
        return;
    }
    LocalStorageStore.setItem(getStorageKey(userId), JSON.stringify(notifications.slice(0, PLATFORM_NOTIFICATION_ACTIVITY_MAX)));
}

export function syncPlatformNotificationActivityToStorage(state: GlobalState): void {
    writePlatformNotificationActivityToStorage(state, getPlatformNotifications(state));
}
