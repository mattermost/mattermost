// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';
import type {PlatformNotificationRecord} from 'types/store/rhs';

export function isPlatformNotificationMarkedRead(record: PlatformNotificationRecord): boolean {
    return Boolean(record.readAt && record.recordedAt <= record.readAt);
}

export function isPlatformNotificationUnread(_state: GlobalState, record: PlatformNotificationRecord): boolean {
    return !isPlatformNotificationMarkedRead(record);
}

export function getPlatformNotificationTimestamp(
    record: PlatformNotificationRecord,
    post?: {create_at?: number} | null,
): number {
    const postTime = post?.create_at || 0;
    const recordedAt = record.recordedAt || 0;

    if (record.isThreadReply && recordedAt > postTime) {
        return recordedAt;
    }

    if (postTime > 0) {
        return postTime;
    }

    return recordedAt;
}
