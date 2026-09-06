// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlatformNotificationRecord} from 'types/store/rhs';

import {
    getPlatformNotificationTimestamp,
    isPlatformNotificationMarkedRead,
    isPlatformNotificationUnread,
} from './platform_notification_unread';

function makeRecord(overrides: Partial<PlatformNotificationRecord> = {}): PlatformNotificationRecord {
    return {
        id: 'n1',
        recordedAt: 100,
        postId: 'post1',
        channelId: 'channel1',
        teamId: 'team1',
        channelDisplayName: 'Town Square',
        contextLabel: 'Message',
        permalinkUrl: '/permalink',
        isThreadReply: false,
        previewBody: '@user: hello',
        ...overrides,
    };
}

describe('platform_notification_unread', () => {
    test('isPlatformNotificationMarkedRead requires readAt at or after recordedAt', () => {
        expect(isPlatformNotificationMarkedRead(makeRecord())).toBe(false);
        expect(isPlatformNotificationMarkedRead(makeRecord({readAt: 50}))).toBe(false);
        expect(isPlatformNotificationMarkedRead(makeRecord({readAt: 100}))).toBe(true);
        expect(isPlatformNotificationMarkedRead(makeRecord({readAt: 150}))).toBe(true);
    });

    test('unread state follows the explicit readAt flag only', () => {
        const record = makeRecord();
        const unusedState = {} as any;

        expect(isPlatformNotificationUnread(unusedState, record)).toBe(true);
        expect(isPlatformNotificationUnread(unusedState, makeRecord({readAt: 150}))).toBe(false);
    });

    test('display time prefers the post create time over ingest time', () => {
        const record = makeRecord({recordedAt: Date.now()});
        expect(getPlatformNotificationTimestamp(record, {create_at: 1_700_000_000_000})).toBe(1_700_000_000_000);
    });

    test('thread display time keeps a later last-reply timestamp', () => {
        const record = makeRecord({
            isThreadReply: true,
            recordedAt: 1_700_000_100_000,
        });
        expect(getPlatformNotificationTimestamp(record, {create_at: 1_700_000_000_000})).toBe(1_700_000_100_000);
    });
});
