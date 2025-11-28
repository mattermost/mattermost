// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import {BATCH} from 'redux-batched-actions';

import type {DeepPartial} from '@mattermost/types/utilities';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {setSystemEmojis} from 'mattermost-redux/actions/emojis';
import {Client4} from 'mattermost-redux/client';

import * as Actions from 'actions/emoji_actions';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import mockStore from 'tests/test_store';
import {Preferences} from 'utils/constants';
import {EmojiIndicesByAlias} from 'utils/emoji';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

Client4.setUrl('http://localhost:8065');

describe('loadRecentlyUsedCustomEmojis', () => {
    const currentUserId = 'currentUserId';

    const emoji1 = TestHelper.getCustomEmojiMock({name: 'emoji1', id: 'emojiId1'});
    const emoji2 = TestHelper.getCustomEmojiMock({name: 'emoji2', id: 'emojiId2'});
    const loadedEmoji = TestHelper.getCustomEmojiMock({name: 'loaded', id: 'loadedId'});

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            emojis: {
                customEmoji: {
                    [loadedEmoji.id]: loadedEmoji,
                },
                nonExistentEmoji: new Set(),
            },
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                },
            },
            users: {
                currentUserId,
            },
        },
    };

    setSystemEmojis(new Set(EmojiIndicesByAlias.keys()));

    test('should get requested emojis', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: emoji1.name, usageCount: 3},
                                {name: emoji2.name, usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        const store = mockStore(state);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', ['emoji1', 'emoji2']).
            reply(200, [emoji1, emoji2]);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([
            {
                type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                data: [emoji1, emoji2],
            },
        ]);
    });

    test('should not request emojis which are already loaded', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: emoji1.name, usageCount: 3},
                                {name: loadedEmoji.name, usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        const store = mockStore(state);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', ['emoji1']).
            reply(200, [emoji1]);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([
            {
                type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                data: [emoji1],
            },
        ]);
    });

    test('should not make a request if all recentl emojis are loaded', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: loadedEmoji.name, usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        const store = mockStore(state);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([]);
    });

    test('should properly store any names of nonexistent emojis', async () => {
        const fakeEmojiName = 'fake-emoji-name';

        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: emoji1.name, usageCount: 3},
                                {name: fakeEmojiName, usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        const store = mockStore(state);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', ['emoji1', fakeEmojiName]).
            reply(200, [emoji1]);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([
            {
                type: BATCH,
                meta: {
                    batch: true,
                },
                payload: [
                    {
                        type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                        data: [emoji1],
                    },
                    {
                        type: EmojiTypes.CUSTOM_EMOJI_DOES_NOT_EXIST,
                        data: fakeEmojiName,
                    },
                ],
            },
        ]);
    });

    test('should not request an emoji that we know does not exist', async () => {
        const fakeEmojiName = 'fake-emoji-name';

        // Add nonExistentEmoji separately because mergeObjects only works with plain objects
        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: emoji1.name, usageCount: 3},
                                {name: fakeEmojiName, usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        state.entities.emojis.nonExistentEmoji = new Set([fakeEmojiName]);
        const store = mockStore(state);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', ['emoji1']).
            reply(200, [emoji1]);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([
            {
                type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                data: [emoji1],
            },
        ]);
    });

    test('should not request a system emoji', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {
                            category: Preferences.RECENT_EMOJIS,
                            name: currentUserId,
                            value: JSON.stringify([
                                {name: emoji1.name, usageCount: 3},
                                {name: 'taco', usageCount: 5},
                            ]),
                        },
                    ]),
                },
            },
        });
        const store = mockStore(state);

        nock(Client4.getBaseRoute()).
            post('/emoji/names', ['emoji1']).
            reply(200, [emoji1]);

        await store.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(store.getActions()).toEqual([
            {
                type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                data: [emoji1],
            },
        ]);
    });
});
