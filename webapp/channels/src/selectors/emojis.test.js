// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mergeObjects from 'mattermost-redux/test/merge_objects';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import Constants, {Preferences} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import * as Selectors from './emojis';

function makeRecentEmojisPreferences(recentEmojis) {
    const userId = 'currentUserId';
    return {
        [getPreferenceKey(Constants.Preferences.RECENT_EMOJIS, userId)]: {
            category: Constants.Preferences.RECENT_EMOJIS,
            name: userId,
            user_id: userId,
            value: JSON.stringify(recentEmojis),
        },
    };
}

describe('getRecentEmojisData', () => {
    const currentUserId = 'currentUserId';
    const baseState = {
        entities: {
            emojis: {
                customEmoji: {},
            },
            general: {
                config: {
                    EnableCustomEmojis: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
            },
        },
    };

    test('should return an empty array when there are no recent emojis in storage', () => {
        expect(Selectors.getRecentEmojisData(baseState)).toEqual([]);
    });

    test('should return the names of recent system emojis', () => {
        const recentEmojis = [
            {name: 'rage', usageCount: 1},
            {name: 'nauseated_face', usageCount: 2},
            {name: 'innocent', usageCount: 3},
            {name: '+1', usageCount: 4},
            {name: 'sob', usageCount: 5},
            {name: 'grinning', usageCount: 6},
            {name: 'mm', usageCount: 7},
        ];
        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual(recentEmojis);
    });

    test('should return the names of recent custom emojis', () => {
        const recentEmojis = [
            {name: 'strawberry', usageCount: 1},
            {name: 'flag-au', usageCount: 1},
            {name: 'kappa', usageCount: 1},
            {name: 'gitlab', usageCount: 1},
            {name: 'thanks', usageCount: 1},
        ];
        const state = mergeObjects(baseState, {
            entities: {
                emojis: {
                    customEmojis: {
                        kappa: TestHelper.getCustomEmojiMock({name: 'kappa'}),
                        gitlab: TestHelper.getCustomEmojiMock({name: 'gitlab'}),
                        thanks: TestHelper.getCustomEmojiMock({name: 'thanks'}),
                    },
                },
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual(recentEmojis);
    });

    test('should return the names of missing emojis so that they can be loaded later', () => {
        const recentEmojis = [
            {name: 'strawberry', usageCount: 1},
            {name: 'flag-au', usageCount: 1},
            {name: 'kappa', usageCount: 1},
            {name: 'gitlab', usageCount: 1},
            {name: 'thanks', usageCount: 1},
        ];
        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual(recentEmojis);
    });

    describe('should return skin toned emojis in the user\'s current skin tone', () => {
        const recentEmojis = [
            {name: 'strawberry', usageCount: 1},
            {name: 'astronaut_dark_skin_tone', usageCount: 2},
            {name: 'male-teacher', usageCount: 3},
            {name: 'nose_light_skin_tone', usageCount: 4},
            {name: 'red_haired_woman_medium_light_skin_tone', usageCount: 5},
            {name: 'point_up_medium_dark_skin_tone', usageCount: 6},
        ];

        test('with no skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: makeRecentEmojisPreferences(recentEmojis),
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut', usageCount: 2},
                {name: 'male-teacher', usageCount: 3},
                {name: 'nose', usageCount: 4},
                {name: 'red_haired_woman', usageCount: 5},
                {name: 'point_up', usageCount: 6},
            ]);
        });

        test('with default skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: 'default'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut', usageCount: 2},
                {name: 'male-teacher', usageCount: 3},
                {name: 'nose', usageCount: 4},
                {name: 'red_haired_woman', usageCount: 5},
                {name: 'point_up', usageCount: 6},
            ]);
        });

        test('with light skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FB'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut_light_skin_tone', usageCount: 2},
                {name: 'male-teacher_light_skin_tone', usageCount: 3},
                {name: 'nose_light_skin_tone', usageCount: 4},
                {name: 'red_haired_woman_light_skin_tone', usageCount: 5},
                {name: 'point_up_light_skin_tone', usageCount: 6},
            ]);
        });

        test('with medium light skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FC'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut_medium_light_skin_tone', usageCount: 2},
                {name: 'male-teacher_medium_light_skin_tone', usageCount: 3},
                {name: 'nose_medium_light_skin_tone', usageCount: 4},
                {name: 'red_haired_woman_medium_light_skin_tone', usageCount: 5},
                {name: 'point_up_medium_light_skin_tone', usageCount: 6},
            ]);
        });

        test('with medium skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FD'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut_medium_skin_tone', usageCount: 2},
                {name: 'male-teacher_medium_skin_tone', usageCount: 3},
                {name: 'nose_medium_skin_tone', usageCount: 4},
                {name: 'red_haired_woman_medium_skin_tone', usageCount: 5},
                {name: 'point_up_medium_skin_tone', usageCount: 6},
            ]);
        });

        test('with medium dark skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FE'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut_medium_dark_skin_tone', usageCount: 2},
                {name: 'male-teacher_medium_dark_skin_tone', usageCount: 3},
                {name: 'nose_medium_dark_skin_tone', usageCount: 4},
                {name: 'red_haired_woman_medium_dark_skin_tone', usageCount: 5},
                {name: 'point_up_medium_dark_skin_tone', usageCount: 6},
            ]);
        });

        test('with dark skin tone set', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            ...makeRecentEmojisPreferences(recentEmojis),
                            [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FF'},
                        },
                    },
                },
            });

            expect(Selectors.getRecentEmojisData(state)).toEqual([
                {name: 'strawberry', usageCount: 1},
                {name: 'astronaut_dark_skin_tone', usageCount: 2},
                {name: 'male-teacher_dark_skin_tone', usageCount: 3},
                {name: 'nose_dark_skin_tone', usageCount: 4},
                {name: 'red_haired_woman_dark_skin_tone', usageCount: 5},
                {name: 'point_up_dark_skin_tone', usageCount: 6},
            ]);
        });
    });

    test('should not change skin tone of emojis with multiple skin tones', () => {
        const recentEmojis = [
            {name: 'strawberry', usageCount: 1},
            {name: 'man_and_woman_holding_hands_medium_light_skin_tone_medium_dark_skin_tone', usageCount: 1},
        ];

        let state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual(recentEmojis);

        state = mergeObjects(state, {
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FB'},
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual(recentEmojis);
    });

    test('should de-duplicate results', () => {
        const recentEmojis = [
            {name: 'banana', usageCount: 1},
            {name: 'banana', usageCount: 1},
            {name: 'apple', usageCount: 1},
            {name: 'banana', usageCount: 1},
        ];

        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual([
            {name: 'apple', usageCount: 1},
            {name: 'banana', usageCount: 3},
        ]);
    });

    test('should de-duplicate results with different skin tones', () => {
        const recentEmojis = [
            {name: 'ear', usageCount: 1},
            {name: 'ear_light_skin_tone', usageCount: 1},
            {name: 'ear_medium_light_skin_tone', usageCount: 1},
            {name: 'nose_dark_skin_tone', usageCount: 1},
            {name: 'nose_medium_dark_skin_tone', usageCount: 1},
            {name: 'nose_light_skin_tone', usageCount: 1},
        ];

        let state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual([
            {name: 'ear', usageCount: 3},
            {name: 'nose', usageCount: 3},
        ]);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FE'},
                    },
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toEqual([
            {name: 'ear_medium_dark_skin_tone', usageCount: 3},
            {name: 'nose_medium_dark_skin_tone', usageCount: 3},
        ]);
    });

    test('should only recalculate if relevant preferences change', () => {
        const recentEmojis = [
            {name: 'apple', usageCount: 1},
            {name: 'banana', usageCount: 1},
        ];

        let state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: makeRecentEmojisPreferences(recentEmojis),
                },
            },
        });
        const previousResult = Selectors.getRecentEmojisData(state);

        expect(Selectors.getRecentEmojisData(state)).toBe(previousResult);

        state = mergeObjects(state, {
            preferences: {
                emojis: {
                    customEmoji: {
                        someNewEmoji: TestHelper.getCustomEmojiMock({name: 'someNewCustomEmoji'}),
                    },
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toBe(previousResult);

        state = mergeObjects(state, {
            preferences: {
                myPreferences: {
                    some_preference: {value: 'some value'},
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).toBe(previousResult);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_EMOJI, Preferences.EMOJI_SKINTONE)]: {value: '1F3FE'},
                    },
                },
            },
        });

        expect(Selectors.getRecentEmojisData(state)).not.toBe(previousResult);
    });
});
