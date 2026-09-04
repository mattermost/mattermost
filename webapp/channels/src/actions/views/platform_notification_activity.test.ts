// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import testConfigureStore from 'tests/test_store';
import {ActionTypes} from 'utils/constants';
import {
    fetchPlatformNotificationsFromServer,
    readPlatformNotificationActivityFromStorage,
} from 'utils/platform_notification_activity_storage';

import {hydratePlatformNotificationActivity} from './rhs';

jest.mock('./platform_notification_activity', () => ({
    fillPlatformNotificationActivity: jest.fn(() => async () => ({data: false})),
}));

jest.mock('utils/platform_notification_activity_storage', () => ({
    fetchPlatformNotificationsFromServer: jest.fn(),
    readPlatformNotificationActivityFromStorage: jest.fn(() => []),
    migrateLocalPlatformNotificationsToServer: jest.fn(),
    syncPlatformNotificationActivityToServer: jest.fn(),
    syncPlatformNotificationActivityToStorage: jest.fn(),
    upsertPlatformNotificationOnServer: jest.fn(),
    deletePlatformNotificationOnServer: jest.fn(),
    clearPlatformNotificationsOnServer: jest.fn(),
}));

const record = {
    id: 'n1',
    recordedAt: 100,
    postId: 'post1',
    channelId: 'channel1',
    teamId: 'team1',
    channelDisplayName: 'Town Square',
    contextLabel: 'Mention',
    permalinkUrl: '/permalink',
    isThreadReply: false,
    previewBody: '@alice: hello',
};

function makeStore() {
    return testConfigureStore({
        entities: {
            users: {
                currentUserId: 'user1',
            },
            channels: {
                channels: {},
            },
            posts: {
                posts: {},
            },
        },
        views: {
            rhs: {
                platformNotifications: [record],
            },
        },
    });
}

describe('hydratePlatformNotificationActivity', () => {
    beforeEach(() => {
        jest.mocked(fetchPlatformNotificationsFromServer).mockReset();
        jest.mocked(readPlatformNotificationActivityFromStorage).mockReturnValue([]);
    });

    test('keeps local Activity when a merge hydrate gets an empty server list', async () => {
        jest.mocked(fetchPlatformNotificationsFromServer).mockResolvedValue([]);
        const store = makeStore();

        const result = await store.dispatch(hydratePlatformNotificationActivity(true));

        expect(result).toEqual({data: false});
        expect(store.getActions()).toEqual([]);
    });

    test('clears Activity when a replace hydrate gets an empty server list', async () => {
        jest.mocked(fetchPlatformNotificationsFromServer).mockResolvedValue([]);
        const store = makeStore();

        const result = await store.dispatch(hydratePlatformNotificationActivity(true, true));

        expect(result).toEqual({data: true});
        expect(store.getActions()).toEqual([
            {type: ActionTypes.CLEAR_PLATFORM_NOTIFICATIONS},
        ]);
    });

    test('replaces Activity from the server list instead of merging', async () => {
        const serverRecord = {...record, id: 'n2', postId: 'post2', previewBody: '@bob: hi'};
        jest.mocked(fetchPlatformNotificationsFromServer).mockResolvedValue([serverRecord]);
        const store = makeStore();

        const result = await store.dispatch(hydratePlatformNotificationActivity(true, true));

        expect(result).toEqual({data: true});
        expect(store.getActions()).toEqual([
            expect.objectContaining({
                type: ActionTypes.RECONCILE_PLATFORM_NOTIFICATIONS,
                data: [expect.objectContaining({id: 'n2', postId: 'post2'})],
            }),
        ]);
    });
});
