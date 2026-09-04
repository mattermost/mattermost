// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PlatformNotification} from '@mattermost/types/platform_notifications';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import LocalStorageStore from 'stores/local_storage_store';

import {
    fromServerPlatformNotification,
    isPlatformNotificationDismissed,
    readDismissedPlatformNotifications,
    rememberDismissedPlatformNotifications,
    toServerPlatformNotification,
} from './platform_notification_activity_storage';

const record: PlatformNotificationRecord = {
    id: 'dm:channel1:100',
    recordedAt: 100,
    postId: 'post1',
    channelId: 'channel1',
    teamId: 'team1',
    channelDisplayName: 'Group',
    contextLabel: 'Message',
    permalinkUrl: '/permalink',
    isThreadReply: false,
    isMention: true,
    isDirectMessage: false,
    isGroupMessage: true,
    senderUserId: 'user2',
    replyCount: 3,
    participantUserIds: ['user2', 'user3'],
    readAt: 200,
    previewBody: '@user2: hello',
};

describe('platform_notification_activity_storage', () => {
    test('round-trips group message fields through the server payload', () => {
        const payload = toServerPlatformNotification(record, 'user1');

        expect(payload).toEqual({
            id: 'dm:channel1:100',
            user_id: 'user1',
            post_id: 'post1',
            channel_id: 'channel1',
            team_id: 'team1',
            recorded_at: 100,
            read_at: 200,
            channel_display_name: 'Group',
            context_label: 'Message',
            permalink_url: '/permalink',
            is_thread_reply: false,
            is_mention: true,
            is_direct_message: false,
            is_group_message: true,
            sender_user_id: 'user2',
            thread_root_id: undefined,
            reply_count: 3,
            participant_user_ids: ['user2', 'user3'],
            preview_body: '@user2: hello',
        });

        expect(fromServerPlatformNotification(payload as PlatformNotification)).toEqual(record);
    });
});

describe('dismissed platform notifications', () => {
    const state = {
        entities: {
            users: {currentUserId: 'user1'},
            general: {config: {}},
        },
    } as any;

    const store: Record<string, string> = {};

    beforeEach(() => {
        Object.keys(store).forEach((key) => {
            delete store[key];
        });
        jest.spyOn(LocalStorageStore, 'getItem').mockImplementation((key: string) => store[key] ?? null);
        jest.spyOn(LocalStorageStore, 'setItem').mockImplementation((key: string, value: string | null) => {
            if (value === null) {
                delete store[key];
                return;
            }
            store[key] = value;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('remembers removed post ids and a clear-all watermark', () => {
        rememberDismissedPlatformNotifications(state, ['post1']);
        expect(readDismissedPlatformNotifications(state, 'user1').postIds).toEqual(['post1']);
        expect(isPlatformNotificationDismissed(state, 'post1', 500)).toBe(true);
        expect(isPlatformNotificationDismissed(state, 'post2', 500)).toBe(false);

        rememberDismissedPlatformNotifications(state, [], 1000);
        expect(isPlatformNotificationDismissed(state, 'post2', 1000)).toBe(true);
        expect(isPlatformNotificationDismissed(state, 'post3', 1001)).toBe(false);
    });
});
