// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, test, expect, vi, beforeEach} from 'vitest';

import {Client4} from 'mattermost-redux/client';
import {Posts, Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {setGlobalItem} from 'actions/storage';

import mockStore from 'tests/test_store';
import {StoragePrefixes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

import {removeDraft, setGlobalDraftSource, updateDraft} from './drafts';

vi.mock('mattermost-redux/client', async (importOriginal) => {
    const original = await importOriginal<typeof import('mattermost-redux/client')>();

    return {
        ...original,
        Client4: {
            ...original.Client4,
            deleteDraft: vi.fn().mockResolvedValue([]),
            upsertDraft: vi.fn().mockResolvedValue([]),
        },
    };
});

vi.mock('actions/storage', async (importOriginal) => {
    const original = await importOriginal<typeof import('actions/storage')>();
    return {
        ...original,
        setGlobalItem: (...args: any) => ({type: 'MOCK_SET_GLOBAL_ITEM', args}),
        actionOnGlobalItemsWithPrefix: (...args: any) => ({type: 'MOCK_ACTION_ON_GLOBAL_ITEMS_WITH_PREFIX', args}),
    };
});

const rootId = 'fc234c34c23';
const currentUserId = '34jrnfj43';
const teamId = '4j5nmn4j3';
const channelId = '4j5j4k3k34j4';
const latestPostId = 'latestPostId';

const enabledSyncedDraftsKey = getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_SYNC_DRAFTS);

describe('draft actions', () => {
    const initialState = {
        entities: {
            posts: {
                posts: {
                    [latestPostId]: {
                        id: latestPostId,
                        user_id: currentUserId,
                        message: 'test msg',
                        channel_id: channelId,
                        root_id: rootId,
                        create_at: 42,
                    },
                    [rootId]: {
                        id: rootId,
                        user_id: currentUserId,
                        message: 'root msg',
                        channel_id: channelId,
                        root_id: '',
                        create_at: 2,
                    },
                },
                postsInChannel: {
                    [channelId]: [
                        {order: [latestPostId], recent: true},
                    ],
                },
                postsInThread: {
                    [rootId]: [latestPostId],
                },
                messagesHistory: {
                    index: {
                        [Posts.MESSAGE_TYPES.COMMENT]: 0,
                    },
                    messages: ['test message'],
                },
            },
            preferences: {
                myPreferences: {
                    [enabledSyncedDraftsKey]: {value: 'true'},
                },
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {id: currentUserId},
                },
            },
            teams: {
                currentTeamId: teamId,
            },
            emojis: {
                customEmoji: {},
            },
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                    AllowSyncedDrafts: 'true',
                },
            },
        },
        storage: {
            storage: {
                [`${StoragePrefixes.COMMENT_DRAFT}${rootId}`]: {
                    value: {
                        message: '',
                        fileInfos: [],
                        uploadsInProgress: [],
                        channelId,
                        rootId,
                    },
                    timestamp: new Date(),
                },
            },
        },
        websocket: {
            connectionId: '',
        },
    };

    let store: any;
    const key = StoragePrefixes.DRAFT + channelId;
    const upsertDraftSpy = vi.spyOn(Client4, 'upsertDraft');
    const deleteDraftSpy = vi.spyOn(Client4, 'deleteDraft');

    beforeEach(() => {
        store = mockStore(initialState);
        vi.clearAllMocks();
    });

    describe('updateDraft', () => {
        const draft = {message: 'test', channelId, fileInfos: [{id: 1}], uploadsInProgress: [2, 3]} as unknown as PostDraft;

        test('calls setGlobalItem action correctly', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(42);

            await store.dispatch(updateDraft(key, draft, '', false));

            const testStore = mockStore(initialState);

            const expectedKey = StoragePrefixes.DRAFT + channelId;
            testStore.dispatch(setGlobalItem(expectedKey, {
                ...draft,
                createAt: 42,
                updateAt: 42,
            }));
            testStore.dispatch(setGlobalDraftSource(expectedKey, false));

            expect(store.getActions()).toEqual(testStore.getActions());
            vi.useRealTimers();
        });

        test('calls upsertDraft correctly', async () => {
            await store.dispatch(updateDraft(key, draft, '', true));
            expect(upsertDraftSpy).toHaveBeenCalled();
        });
    });

    describe('removeDraft', () => {
        test('calls setGlobalItem action correctly', async () => {
            await store.dispatch(removeDraft(key, channelId));

            const testStore = mockStore(initialState);

            testStore.dispatch(setGlobalItem(StoragePrefixes.DRAFT + channelId, {
                message: '',
                fileInfos: [],
                uploadsInProgress: [],
                metadata: {},
            }));

            expect(store.getActions()).toEqual(testStore.getActions());
        });

        test('calls upsertDraft correctly', async () => {
            await store.dispatch(removeDraft(key, channelId));
            expect(deleteDraftSpy).toHaveBeenCalled();
        });
    });
});
