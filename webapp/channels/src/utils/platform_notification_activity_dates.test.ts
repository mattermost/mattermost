// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import {addDateSeparatorsForPlatformNotifications} from './platform_notification_activity_dates';

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

const utcUser = {
    id: '1234',
    username: 'user',
    timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'},
} as UserProfile;

describe('addDateSeparatorsForPlatformNotifications', () => {
    test('adds a date separator when the day changes', () => {
        const time = Date.now();
        const today = new Date(time);
        const yesterday = new Date(time - (24 * 60 * 60 * 1000));
        const dayBeforeYesterday = new Date(time - (2 * 24 * 60 * 60 * 1000));

        const notifications = [
            makeRecord({id: 'n1', postId: 'post1', recordedAt: today.getTime()}),
            makeRecord({id: 'n2', postId: 'post2', recordedAt: yesterday.getTime()}),
            makeRecord({id: 'n3', postId: 'post3', recordedAt: dayBeforeYesterday.getTime()}),
        ];

        const result = addDateSeparatorsForPlatformNotifications(notifications, {}, utcUser);

        expect(result).toHaveLength(6);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(notifications[0]);
        expect(result[2]).toBe('date-' + yesterday.getTime());
        expect(result[3]).toBe(notifications[1]);
        expect(result[4]).toBe('date-' + dayBeforeYesterday.getTime());
        expect(result[5]).toBe(notifications[2]);
    });

    test('keeps one date separator for notifications on the same day', () => {
        const time = Date.now();
        const today = new Date(time);

        const notifications = [
            makeRecord({id: 'n1', postId: 'post1', recordedAt: today.getTime()}),
            makeRecord({id: 'n2', postId: 'post2', recordedAt: today.getTime() + 1000}),
            makeRecord({id: 'n3', postId: 'post3', recordedAt: today.getTime() + 2000}),
        ];

        const result = addDateSeparatorsForPlatformNotifications(notifications, {}, utcUser);

        expect(result).toHaveLength(4);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(notifications[0]);
        expect(result[2]).toBe(notifications[1]);
        expect(result[3]).toBe(notifications[2]);
    });

    test('uses the post create time for grouping when available', () => {
        const today = Date.now();
        const yesterday = today - (24 * 60 * 60 * 1000);
        const notifications = [
            makeRecord({id: 'n1', postId: 'post1', recordedAt: today}),
        ];

        const result = addDateSeparatorsForPlatformNotifications(
            notifications,
            {post1: {create_at: yesterday}},
            utcUser,
        );

        expect(result[0]).toBe('date-' + yesterday);
        expect(result[1]).toBe(notifications[0]);
    });

    test('applies the user timezone the same way mentions does', () => {
        const todayTimestamp = 1704067200000;
        const todayTimestampInAmericaNewYork = 1704049200000;
        const nyUser = {
            id: '1234',
            username: 'user',
            timezone: {useAutomaticTimezone: 'false', manualTimezone: 'America/New_York'},
        } as UserProfile;

        const notifications = [
            makeRecord({id: 'n1', postId: 'post1', recordedAt: todayTimestampInAmericaNewYork}),
            makeRecord({id: 'n2', postId: 'post2', recordedAt: todayTimestamp}),
        ];

        const result = addDateSeparatorsForPlatformNotifications(notifications, {}, nyUser);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe('date-1704031200000');
        expect(result[1]).toBe(notifications[0]);
        expect(result[2]).toBe(notifications[1]);
    });
});
