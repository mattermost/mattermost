// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PLATFORM_NOTIFICATION_BURST_WINDOW_MS} from 'utils/constants';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import {
    consolidateThreadReplyNotifications,
    createBurstNotificationId,
    findBurstMergeTarget,
    getDirectMessageGroupKey,
    getPrivateMessageGroupKey,
    getThreadReplyGroupKey,
    isWithinNotificationBurstWindow,
    mergeDirectMessageIntoRecord,
    mergeThreadReplyIntoRecord,
    sortPlatformNotificationsByRecency,
} from './platform_notification_activity_merge';

function makeRecord(overrides: Partial<PlatformNotificationRecord> & Pick<PlatformNotificationRecord, 'id' | 'postId' | 'recordedAt'>): PlatformNotificationRecord {
    return {
        channelId: 'channel1',
        teamId: 'team1',
        channelDisplayName: 'Town Square',
        contextLabel: 'Message in thread',
        permalinkUrl: '/permalink',
        isThreadReply: true,
        senderUserId: 'user1',
        threadRootId: 'root1',
        previewBody: 'hello',
        ...overrides,
    };
}

describe('platform_notification_activity_merge', () => {
    test('getThreadReplyGroupKey returns null for non-thread notifications', () => {
        expect(getThreadReplyGroupKey(makeRecord({
            id: '1',
            postId: 'p1',
            recordedAt: 1,
            isThreadReply: false,
        }))).toBeNull();
    });

    test('getThreadReplyGroupKey groups by thread root only', () => {
        expect(getThreadReplyGroupKey(makeRecord({
            id: '1',
            postId: 'p1',
            recordedAt: 1,
            senderUserId: 'user1',
        }))).toBe('root1');
    });

    test('mergeThreadReplyIntoRecord keeps latest post and preserves burst id', () => {
        const existing = makeRecord({
            id: 'thread:root1:100',
            postId: 'p1',
            recordedAt: 100,
            previewBody: 'first',
            participantUserIds: ['user1'],
        });
        const incoming = makeRecord({
            id: '2',
            postId: 'p2',
            recordedAt: 200,
            previewBody: 'second',
            senderUserId: 'user2',
        });

        expect(mergeThreadReplyIntoRecord(existing, incoming)).toEqual({
            ...existing,
            id: 'thread:root1:100',
            postId: 'p2',
            recordedAt: 200,
            previewBody: 'second',
            senderUserId: 'user2',
            replyCount: 2,
            participantUserIds: ['user1', 'user2'],
        });
    });

    test('mergeThreadReplyIntoRecord clears readAt when a newer reply arrives', () => {
        const existing = makeRecord({
            id: 'thread:root1:100',
            postId: 'p1',
            recordedAt: 100,
            readAt: 150,
        });
        const incoming = makeRecord({
            id: '2',
            postId: 'p2',
            recordedAt: 200,
            senderUserId: 'user2',
        });

        expect(mergeThreadReplyIntoRecord(existing, incoming).readAt).toBeUndefined();
    });

    test('consolidateThreadReplyNotifications merges replies in the same thread burst', () => {
        const records = [
            makeRecord({id: '1', postId: 'p1', recordedAt: 100, previewBody: 'one', senderUserId: 'user1'}),
            makeRecord({id: '2', postId: 'p2', recordedAt: 200, previewBody: 'two', senderUserId: 'user2'}),
            makeRecord({
                id: '3',
                postId: 'p3',
                recordedAt: 150,
                previewBody: 'other thread',
                threadRootId: 'root2',
                senderUserId: 'user3',
            }),
        ];

        const consolidated = consolidateThreadReplyNotifications(records);

        expect(consolidated).toHaveLength(2);
        expect(consolidated[0]).toMatchObject({
            id: 'thread:root1:100',
            postId: 'p2',
            previewBody: 'two',
            replyCount: 2,
            participantUserIds: ['user1', 'user2'],
        });
        expect(consolidated[1]).toMatchObject({
            id: 'thread:root2:150',
            postId: 'p3',
            replyCount: 1,
            participantUserIds: ['user3'],
        });
    });

    test('consolidateThreadReplyNotifications splits thread replies outside the burst window', () => {
        const gap = PLATFORM_NOTIFICATION_BURST_WINDOW_MS + 1;
        const records = [
            makeRecord({id: '1', postId: 'p1', recordedAt: 100, previewBody: 'one'}),
            makeRecord({id: '2', postId: 'p2', recordedAt: 100 + gap, previewBody: 'two'}),
        ];

        const consolidated = consolidateThreadReplyNotifications(records);

        expect(consolidated).toHaveLength(2);
        expect(consolidated[0]).toMatchObject({
            id: `thread:root1:${100 + gap}`,
            postId: 'p2',
            replyCount: 1,
        });
        expect(consolidated[1]).toMatchObject({
            id: 'thread:root1:100',
            postId: 'p1',
            replyCount: 1,
        });
    });

    test('consolidateThreadReplyNotifications merges many replies into one burst', () => {
        const senderUserIds = ['user1', 'user2', 'user3'];
        const records = Array.from({length: 50}, (_, index) => makeRecord({
            id: `legacy-${index}`,
            postId: `p${index}`,
            recordedAt: 100 + index,
            previewBody: `reply ${index}`,
            senderUserId: senderUserIds[index % 3],
        }));

        const consolidated = consolidateThreadReplyNotifications(records);

        expect(consolidated).toHaveLength(1);
        expect(consolidated[0]).toMatchObject({
            id: 'thread:root1:100',
            postId: 'p49',
            replyCount: 50,
            participantUserIds: ['user1', 'user2', 'user3'],
        });
    });

    test('getDirectMessageGroupKey groups direct and group messages by channel only', () => {
        expect(getDirectMessageGroupKey({
            ...makeRecord({
                id: '1',
                postId: 'p1',
                recordedAt: 1,
                isThreadReply: false,
            }),
            isDirectMessage: true,
            channelId: 'dm-channel',
        })).toBe('dm-channel');

        expect(getPrivateMessageGroupKey({
            ...makeRecord({
                id: '1',
                postId: 'p1',
                recordedAt: 1,
                isThreadReply: false,
            }),
            isGroupMessage: true,
            channelId: 'gm-channel',
        })).toBe('gm-channel');

        expect(getDirectMessageGroupKey(makeRecord({
            id: '1',
            postId: 'p1',
            recordedAt: 1,
            isThreadReply: false,
        }))).toBeNull();
    });

    test('mergeDirectMessageIntoRecord keeps latest message and preserves burst id', () => {
        const existing = {
            id: 'dm:channel1:100',
            postId: 'p1',
            recordedAt: 100,
            channelId: 'channel1',
            teamId: 'team1',
            channelDisplayName: 'baba',
            contextLabel: 'Message',
            permalinkUrl: '/permalink',
            isThreadReply: false,
            isDirectMessage: true,
            senderUserId: 'user1',
            previewBody: 'first',
            replyCount: 1,
        };
        const incoming = {
            ...existing,
            id: 'p2:200',
            postId: 'p2',
            recordedAt: 200,
            previewBody: 'second',
        };

        expect(mergeDirectMessageIntoRecord(existing, incoming)).toMatchObject({
            id: 'dm:channel1:100',
            postId: 'p2',
            previewBody: 'second',
            replyCount: 2,
        });
    });

    test('consolidateThreadReplyNotifications merges direct messages within the burst window', () => {
        const makeDm = (postId: string, recordedAt: number, previewBody: string): PlatformNotificationRecord => ({
            id: `${postId}:${recordedAt}`,
            postId,
            recordedAt,
            channelId: 'channel1',
            teamId: 'team1',
            channelDisplayName: 'baba',
            contextLabel: 'Message',
            permalinkUrl: '/permalink',
            isThreadReply: false,
            isDirectMessage: true,
            senderUserId: 'user1',
            previewBody,
        });

        const consolidated = consolidateThreadReplyNotifications([
            makeDm('p1', 100, 'boy this looks cool.'),
            makeDm('p2', 200, 'what @asaad'),
        ]);

        expect(consolidated).toHaveLength(1);
        expect(consolidated[0]).toMatchObject({
            id: 'dm:channel1:100',
            postId: 'p2',
            previewBody: 'what @asaad',
            replyCount: 2,
        });
    });

    test('consolidateThreadReplyNotifications splits direct messages outside the burst window', () => {
        const gap = PLATFORM_NOTIFICATION_BURST_WINDOW_MS + 1;
        const makeDm = (postId: string, recordedAt: number, previewBody: string): PlatformNotificationRecord => ({
            id: `${postId}:${recordedAt}`,
            postId,
            recordedAt,
            channelId: 'channel1',
            teamId: 'team1',
            channelDisplayName: 'baba',
            contextLabel: 'Message',
            permalinkUrl: '/permalink',
            isThreadReply: false,
            isDirectMessage: true,
            senderUserId: 'user1',
            previewBody,
        });

        const consolidated = consolidateThreadReplyNotifications([
            makeDm('p1', 100, 'first'),
            makeDm('p2', 100 + gap, 'second'),
        ]);

        expect(consolidated).toHaveLength(2);
        expect(consolidated[0]).toMatchObject({
            id: `dm:channel1:${100 + gap}`,
            postId: 'p2',
            replyCount: 1,
        });
        expect(consolidated[1]).toMatchObject({
            id: 'dm:channel1:100',
            postId: 'p1',
            replyCount: 1,
        });
    });

    test('findBurstMergeTarget ignores channel posts', () => {
        const channelPost = {
            ...makeRecord({
                id: 'post:1',
                postId: 'p1',
                recordedAt: 200,
                isThreadReply: false,
            }),
            previewBody: 'channel message',
        };

        expect(findBurstMergeTarget([channelPost], {
            ...channelPost,
            id: 'post:2',
            postId: 'p2',
            recordedAt: 250,
        })).toBeNull();
    });

    test('createBurstNotificationId encodes burst anchor timestamps', () => {
        expect(createBurstNotificationId(makeRecord({
            id: '1',
            postId: 'p1',
            recordedAt: 12345,
        }))).toBe('thread:root1:12345');

        expect(createBurstNotificationId({
            ...makeRecord({
                id: '1',
                postId: 'p1',
                recordedAt: 999,
                isThreadReply: false,
            }),
            isDirectMessage: true,
            channelId: 'channel1',
        })).toBe('dm:channel1:999');
    });

    test('createBurstNotificationId works for new private messages without an existing id', () => {
        expect(createBurstNotificationId({
            ...makeRecord({
                postId: 'p1',
                recordedAt: 12345,
                isThreadReply: false,
            }),
            isGroupMessage: true,
            channelId: 'gm-channel',
        })).toBe('dm:gm-channel:12345');
    });

    test('isWithinNotificationBurstWindow respects the configured window', () => {
        expect(isWithinNotificationBurstWindow(100, 100, 300000)).toBe(true);
        expect(isWithinNotificationBurstWindow(100, 100 + PLATFORM_NOTIFICATION_BURST_WINDOW_MS, 300000)).toBe(true);
        expect(isWithinNotificationBurstWindow(100, 100 + PLATFORM_NOTIFICATION_BURST_WINDOW_MS + 1, 300000)).toBe(false);
    });

    test('sortPlatformNotificationsByRecency orders newest notifications first', () => {
        const sorted = sortPlatformNotificationsByRecency([
            makeRecord({id: '1', postId: 'p1', recordedAt: 100}),
            makeRecord({id: '2', postId: 'p2', recordedAt: 300}),
            makeRecord({id: '3', postId: 'p3', recordedAt: 200}),
        ]);

        expect(sorted.map((record) => record.postId)).toEqual(['p2', 'p3', 'p1']);
    });

    test('consolidateThreadReplyNotifications promotes an updated burst row by recency', () => {
        const channelPost = {
            ...makeRecord({
                id: 'post:1',
                postId: 'channel-post',
                recordedAt: 2000,
                isThreadReply: false,
            }),
            previewBody: 'channel message',
        };
        const dmBurst = {
            id: 'dm:channel1:1000',
            postId: 'p1',
            recordedAt: 1000,
            channelId: 'channel1',
            teamId: 'team1',
            channelDisplayName: 'baba',
            contextLabel: 'Message',
            permalinkUrl: '/permalink',
            isThreadReply: false,
            isDirectMessage: true,
            senderUserId: 'user1',
            previewBody: 'first dm',
            replyCount: 1,
        };
        const incomingDm = {
            id: 'p2:2500',
            postId: 'p2',
            recordedAt: 2500,
            channelId: 'channel1',
            teamId: 'team1',
            channelDisplayName: 'baba',
            contextLabel: 'Message',
            permalinkUrl: '/permalink',
            isThreadReply: false,
            isDirectMessage: true,
            senderUserId: 'user1',
            previewBody: 'second dm',
        };

        const consolidated = consolidateThreadReplyNotifications([
            channelPost,
            dmBurst,
            incomingDm,
        ]);

        expect(consolidated.map((record) => record.postId)).toEqual(['p2', 'channel-post']);
        expect(consolidated[0]).toMatchObject({
            id: 'dm:channel1:1000',
            postId: 'p2',
            recordedAt: 2500,
            replyCount: 2,
        });
    });
});
