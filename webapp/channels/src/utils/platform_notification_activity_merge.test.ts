// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    consolidateThreadReplyNotifications,
    getDirectMessageGroupKey,
    getDirectMessageNotificationId,
    getThreadReplyGroupKey,
    mergeDirectMessageIntoRecord,
    mergeGroupedPlatformNotification,
    mergeThreadReplyIntoRecord,
} from './platform_notification_activity_merge';

import type {PlatformNotificationRecord} from 'types/store/rhs';

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

        expect(getThreadReplyGroupKey(makeRecord({
            id: '2',
            postId: 'p2',
            recordedAt: 2,
            senderUserId: 'user2',
        }))).toBe('root1');
    });

    test('mergeThreadReplyIntoRecord keeps latest post and tracks participants', () => {
        const existing = makeRecord({
            id: 'group1',
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
            id: 'thread:root1',
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
            id: 'thread:root1',
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

    test('consolidateThreadReplyNotifications merges replies in the same thread', () => {
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
            id: 'thread:root1',
            postId: 'p2',
            previewBody: 'two',
            replyCount: 2,
            participantUserIds: ['user1', 'user2'],
        });
        expect(consolidated[1]).toMatchObject({
            id: 'thread:root2',
            postId: 'p3',
            replyCount: 1,
            participantUserIds: ['user3'],
        });
    });

    test('consolidateThreadReplyNotifications merges many replies into one item', () => {
        const records = Array.from({length: 50}, (_, index) => makeRecord({
            id: `legacy-${index}`,
            postId: `p${index}`,
            recordedAt: 100 + index,
            previewBody: `reply ${index}`,
            senderUserId: index % 3 === 0 ? 'user1' : index % 3 === 1 ? 'user2' : 'user3',
        }));

        const consolidated = consolidateThreadReplyNotifications(records);

        expect(consolidated).toHaveLength(1);
        expect(consolidated[0]).toMatchObject({
            postId: 'p49',
            replyCount: 50,
            participantUserIds: ['user1', 'user2', 'user3'],
        });
    });

    test('getDirectMessageGroupKey groups direct messages by channel only', () => {
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

        expect(getDirectMessageGroupKey(makeRecord({
            id: '1',
            postId: 'p1',
            recordedAt: 1,
            isThreadReply: false,
        }))).toBeNull();
    });

    test('mergeDirectMessageIntoRecord keeps latest message and tracks count', () => {
        const existing = {
            id: 'dm:channel1',
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
            id: 'dm:channel1',
            postId: 'p2',
            previewBody: 'second',
            replyCount: 2,
        });
    });

    test('consolidateThreadReplyNotifications merges direct messages in the same channel', () => {
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
            id: 'dm:channel1',
            postId: 'p2',
            previewBody: 'what @asaad',
            replyCount: 2,
        });
    });
});
