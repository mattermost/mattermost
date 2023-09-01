// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setGlobalItem} from 'actions/storage';
import {PostDraft} from 'types/store/draft';
import {StoragePrefixes} from 'utils/constants';

import mockStore from 'tests/test_store';

import {Posts, Preferences} from 'mattermost-redux/constants';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {Client4} from 'mattermost-redux/client';

import {removeDraft, setGlobalDraftSource, updateDraft} from './drafts';

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');

    return {
        ...original,
        Client4: {
            ...original.Client4,
            deleteDraft: jest.fn().mockResolvedValue([]),
            upsertDraft: jest.fn().mockResolvedValue([]),
        },
    };
});

jest.mock('actions/storage', () => {
    const original = jest.requireActual('actions/storage');
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
    const upsertDraftSpy = jest.spyOn(Client4, 'upsertDraft');
    const deleteDraftSpy = jest.spyOn(Client4, 'deleteDraft');

    beforeEach(() => {
        store = mockStore(initialState);
    });

    describe('updateDraft', () => {
        const draft = {message: 'test', channelId, fileInfos: [{id: 1}], uploadsInProgress: [2, 3]} as unknown as PostDraft;

        it('calls setGlobalItem action correctly', async () => {
            jest.useFakeTimers('modern');
            jest.setSystemTime(42);

            await store.dispatch(updateDraft(key, draft, false, true));

            const testStore = mockStore(initialState);

            const expectedKey = StoragePrefixes.DRAFT + channelId;
            testStore.dispatch(setGlobalItem(expectedKey, {
                ...draft,
                createAt: 42,
                updateAt: 42,
            }));
            testStore.dispatch(setGlobalDraftSource(expectedKey, false));

            expect(store.getActions()).toEqual(testStore.getActions());
            jest.useRealTimers();
        });

        it('calls setGlobalItem action correctly delayed', async () => {
            jest.useFakeTimers('modern');
            jest.setSystemTime(42);

            await store.dispatch(updateDraft(key, draft, false, false));

            const testStore = mockStore(initialState);

            const expectedKey = StoragePrefixes.DRAFT + channelId;
            testStore.dispatch(setGlobalItem(expectedKey, {
                ...draft,
                createAt: 42,
                updateAt: 42,
            }));
            testStore.dispatch(setGlobalDraftSource(expectedKey, false));

            expect(store.getActions()).toHaveLength(0);
            jest.runOnlyPendingTimers();
            expect(store.getActions()).toEqual(testStore.getActions());
            jest.useRealTimers();
        });

        it('calls upsertDraft correctly', async () => {
            await store.dispatch(updateDraft(key, draft, true, true));
            expect(upsertDraftSpy).toHaveBeenCalled();
        });

        it('calls upsertDraft correctly delayed', async () => {
            jest.useFakeTimers('modern');
            await store.dispatch(updateDraft(key, draft, true, false));
            expect(upsertDraftSpy).toHaveBeenCalledTimes(0);
            jest.runOnlyPendingTimers();
            expect(upsertDraftSpy).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('removeDraft', () => {
        it('calls setGlobalItem action correctly', async () => {
            await store.dispatch(removeDraft(key, channelId));

            const testStore = mockStore(initialState);

            testStore.dispatch(setGlobalItem(StoragePrefixes.DRAFT + channelId, {
                message: '',
                fileInfos: [],
                uploadsInProgress: [],
            }));

            expect(store.getActions()).toEqual(testStore.getActions());
        });

        it('calls upsertDraft correctly', async () => {
            await store.dispatch(removeDraft(key, channelId));
            expect(deleteDraftSpy).toHaveBeenCalled();
        });
    });
});
