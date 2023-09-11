// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import * as Selectors from './emojis';

import mergeObjects from '../../../test/merge_objects';
import TestHelper from '../../../test/test_helper';

describe('getCustomEmojis', () => {
    const emoji1 = {id: TestHelper.generateId(), name: 'a', creator_id: TestHelper.generateId()};
    const emoji2 = {id: TestHelper.generateId(), name: 'b', creator_id: TestHelper.generateId()};

    const baseState = deepFreezeAndThrowOnMutation({
        entities: {
            emojis: {
                customEmoji: {
                    emoji1,
                    emoji2,
                },
            },
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                },
            },
        },
    });

    test('should return custom emojis', () => {
        expect(Selectors.getCustomEmojis(baseState)).toBe(baseState.entities.emojis.customEmoji);
    });

    test('should return an empty object when custom emojis are disabled', () => {
        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableCustomEmoji: 'false',
                    },
                },
            },
        });

        expect(Selectors.getCustomEmojis(state)).toEqual({});
    });

    test('MM-27679 should memoize properly', () => {
        let state = baseState;

        expect(Selectors.getCustomEmojis(state)).toBe(Selectors.getCustomEmojis(state));

        state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableCustomEmoji: 'false',
                    },
                },
            },
        });

        expect(Selectors.getCustomEmojis(state)).toBe(Selectors.getCustomEmojis(state));
    });
});

describe('getCustomEmojiIdsSortedByName', () => {
    const emoji1 = {id: TestHelper.generateId(), name: 'a', creator_id: TestHelper.generateId()};
    const emoji2 = {id: TestHelper.generateId(), name: 'b', creator_id: TestHelper.generateId()};
    const emoji3 = {id: TestHelper.generateId(), name: '0', creator_id: TestHelper.generateId()};

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            emojis: {
                customEmoji: {
                    [emoji1.id]: emoji1,
                    [emoji2.id]: emoji2,
                    [emoji3.id]: emoji3,
                },
            },
            general: {
                config: {
                    EnableCustomEmoji: 'true',
                },
            },
        },
    });

    test('should get sorted emoji ids', () => {
        expect(Selectors.getCustomEmojiIdsSortedByName(testState)).toEqual([emoji3.id, emoji1.id, emoji2.id]);
    });
});
