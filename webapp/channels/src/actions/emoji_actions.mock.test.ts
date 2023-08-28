// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import {EmojiTypes} from 'mattermost-redux/action_types';
import {Preferences} from 'mattermost-redux/constants';

import * as Actions from 'actions/emoji_actions';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

describe('loadRecentlyUsedCustomEmojis', () => {
    const currentUserId = 'currentUserId';

    const emoji1 = TestHelper.getCustomEmojiMock({id: 'emoji1', name: 'emoji_one'});
    const emoji3 = TestHelper.getCustomEmojiMock({id: 'emoji3', name: 'emoji_three'});
    const emoji4 = TestHelper.getCustomEmojiMock({id: 'emoji4', name: 'emoji_four'});

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            emojis: {
                customEmoji: {
                    emoji1,
                    emoji3,
                    emoji4,
                },
                nonExistentEmoji: new Set(),
            },
            general: {
                config: {EnableCustomEmoji: 'true'},
            },
            users: {
                currentUserId,
            },
        },
    };

    test('Get only emojis missing on the map', () => {
        const recentEmojis = [{name: 'emoji_one'}, {name: 'emoji_two'}, {name: 'emoji_three'}, {name: 'emoji_five'}];

        const testStore = mockStore(mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {category: Preferences.RECENT_EMOJIS, name: currentUserId, value: JSON.stringify(recentEmojis)},
                    ]),
                },
            },
        }));

        const expectedActions: AnyAction[] = [
            {type: EmojiTypes.FETCH_EMOJIS_BY_NAME, names: ['emoji_two', 'emoji_five']},
        ];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('Does not get any emojis if none is missing on the map', () => {
        const recentEmojis = [{name: 'emoji_one'}, {name: 'emoji_three'}];

        const testStore = mockStore(mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {category: Preferences.RECENT_EMOJIS, name: currentUserId, value: JSON.stringify(recentEmojis)},
                    ]),
                },
            },
        }));

        const expectedActions: AnyAction[] = [];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('Does not get any emojis if they are not enabled', () => {
        const recentEmojis = [{name: 'emoji_one'}, {name: 'emoji_two'}, {name: 'emoji_three'}, {name: 'emoji_five'}];

        const testStore = mockStore(mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableCustomEmoji: 'false',
                    },
                },
                preferences: {
                    myPreferences: TestHelper.getPreferencesMock([
                        {category: Preferences.RECENT_EMOJIS, name: currentUserId, value: JSON.stringify(recentEmojis)},
                    ]),
                },
            },
        }));

        const expectedActions: AnyAction[] = [];

        testStore.dispatch(Actions.loadRecentlyUsedCustomEmojis());

        expect(testStore.getActions()).toEqual(expectedActions);
    });
});
