// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    isCategoryHeaderRow,
    getFilteredEmojis,
    calculateCategoryRowIndex,
    splitEmojisToRows,
    createEmojisPositions,
    createCategoryAndEmojiRows,
} from 'components/emoji_picker/utils';

enum SkinTones {
    Light = '1F3FB',
    MediumLight ='1F3FC',
    Medium = '1F3FD',
    MediumDark = '1F3FE',
    Dark = '1F3FF'
}

const smileEmoji = {
    unified: 'smile',
    short_names: 'smile',
    name: 'smile',
};
const thumbsupEmoji = {
    name: 'THUMBS UP SIGN',
    unified: '1F44D',
    short_names: [
        '+1',
        'thumbsup',
    ],
};
const thumbsupEmojiLightSkin = {
    unified: '1F44D-1F3FB',
    short_name: '+1_light_skin_tone',
    short_names: [
        '+1_light_skin_tone',
        'thumbsup_light_skin_tone',
    ],
    name: 'THUMBS UP SIGN: LIGHT SKIN TONE',
    category: 'people-body',
    skins: [
        '1F3FB',
    ],
};
const thumbsupEmojiMediumSkin = {
    unified: '1F44D-1F3FD',
    short_name: '+1_medium_skin_tone',
    short_names: [
        '+1_medium_skin_tone',
        'thumbsup_medium_skin_tone',
    ],
    name: 'THUMBS UP SIGN: MEDIUM SKIN TONE',
    category: 'people-body',
    skins: [
        '1F3FD',
    ],
};
const thumbsupEmojiDarkSkin = {
    unified: '1F44D-1F3FF',
    short_name: '+1_dark_skin_tone',
    short_names: [
        '+1_dark_skin_tone',
        'thumbsup_dark_skin_tone',
    ],
    name: 'THUMBS UP SIGN: DARK SKIN TONE',
    category: 'people-body',
    skins: [
        '1F3FF',
    ],
};
const thumbsdownEmoji = {
    unified: 'thumbsdown',
    short_names: ['thumbs_down', 'down'],
    name: 'thumbsdown',
};
const okEmoji = {
    unified: 'ok',
    short_names: ['ok', 'ok_hand'],
    name: 'ok',
};
const hundredEmoji = {
    unified: 'hundred',
    short_names: ['hundred', '100'],
    name: 'hundred',
};

const recentCategory = {
    id: 'recent',
    message: 'recent_message',
    name: 'recent',
    className: 'recent-classname',
    emojiIds: [hundredEmoji.unified, okEmoji.unified],
};

describe('isCategoryHeaderRow', () => {
    test('should return true if its a category header row', () => {
        const categoryHeaderRow: any = {
            index: 1,
            type: 'categoryHeaderRow',
        };

        expect(isCategoryHeaderRow(categoryHeaderRow)).toBe(true);
    });

    test('should return false if its emoji row', () => {
        const emojiRow: any = {
            index: 1,
            type: 'emojiRow',
        };

        expect(isCategoryHeaderRow(emojiRow)).toBe(false);
    });
});

describe('getFilteredEmojis', () => {
    test('Should show no result when there are no emojis to start with', () => {
        const allEmojis = {};
        const filter = 'example';
        const recentEmojisString: string[] = [];
        const userSkinTone = '';

        expect(getFilteredEmojis(allEmojis, filter, recentEmojisString, userSkinTone)).toEqual([]);
    });

    test('Should return same result when no filter is applied', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };
        const filter = '';
        const recentEmojisString: string[] = [];
        const userSkinTone = '';

        const filteredEmojis = [
            smileEmoji,
            thumbsupEmoji,
            thumbsdownEmoji,
        ];

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toStrictEqual(filteredEmojis);
    });

    test('Should return correct result of single match when appropriate filter is applied', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };
        const filter = 'up';
        const recentEmojisString: string[] = [];
        const userSkinTone = '';

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toStrictEqual([thumbsupEmoji]);
    });

    test('Should return correct result of multiple match when appropriate filter is applied', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };
        const filter = 'thumbs';
        const recentEmojisString: string[] = [];
        const userSkinTone = '';

        const filteredResults = [
            thumbsdownEmoji,
            thumbsupEmoji,
        ];

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toEqual(filteredResults);
    });

    test('Should return correct order of result when filter is applied and contains recently used emojis', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };
        const filter = 'thumbs';
        const recentEmojisString = ['thumbsup'];
        const userSkinTone = '';

        const filteredResults = [
            thumbsupEmoji,
            thumbsdownEmoji,
        ];

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toEqual(filteredResults);
    });

    test('Should filter emojis containing skin tone with user skin tone', () => {
        const allEmojis = {
            thumbsup: thumbsupEmoji,
            thumbsupDark: thumbsupEmojiDarkSkin,
            thumbsupLight: thumbsupEmojiLightSkin,
            thumbsupMedium: thumbsupEmojiMediumSkin,
        };
        const filter = 'thumbs';
        const recentEmojisString: string[] = [];
        const userSkinTone = SkinTones.Dark;

        // Note that filteredResults doesn't match what will be returned in a real use case because the variants of
        // thumbsup will be deduped when using non-test data
        const filteredResults = [
            thumbsupEmoji,
            thumbsupEmojiDarkSkin,
        ];

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toEqual(filteredResults);
    });

    test('Should filter recent emojis', () => {
        const allEmojis = {
            thumbsup: thumbsupEmoji,
            thumbsupDark: thumbsupEmojiDarkSkin,
            thumbsupLight: thumbsupEmojiLightSkin,
            thumbsupMedium: thumbsupEmojiMediumSkin,
        };
        const filter = 'thumbs';
        const recentEmojisString = ['thumbsupDark'];
        const userSkinTone = SkinTones.Dark;

        // Note that filteredResults doesn't match what will be returned in a real use case because the variants of
        // thumbsup will be deduped when using non-test data
        const filteredResults = [
            thumbsupEmojiDarkSkin,
            thumbsupEmoji,
        ];

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toEqual(filteredResults);
    });

    test('Should be case-insensitive', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };
        const filter = 'DoWn';
        const recentEmojisString: string[] = [];
        const userSkinTone = '';

        expect(getFilteredEmojis(allEmojis as any, filter, recentEmojisString, userSkinTone)).toStrictEqual([thumbsdownEmoji]);
    });
});

describe('calculateCategoryRowIndex', () => {
    const categories = {
        recent: recentCategory,
        'people-body': {
            emojiIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15'],
            id: 'people-body',
            name: 'people-body',
        },
        'animals-nature': {
            emojiIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'],
            id: 'animals-nature',
            name: 'animals-nature',
        },
        'food-drink': {
            emojiIds: ['f1'],
            id: 'food-drink',
            name: 'food-drink',
        },
    };

    test('Should return 0 row index for first category', () => {
        expect(calculateCategoryRowIndex(categories as any, 'recent')).toBe(0);
    });

    test('Should return correct row index when emojis in a category are more than emoji_per_row', () => {
        expect(calculateCategoryRowIndex(categories as any, 'animals-nature')).toBe(2 + 3);
    });

    test('Should return correct row index when emoji in previous category are less than emoji_per_row', () => {
        expect(calculateCategoryRowIndex(categories as any, 'food-drink')).toBe(2 + 3 + 2);
    });
});

describe('splitEmojisToRows', () => {
    test('Should return empty when no emojis are passed', () => {
        expect(splitEmojisToRows([], 0, 'recent', 0)).toEqual([[], -1]);
    });

    test('Should create only one row when passed emojis are less than emoji_per_row', () => {
        const emojis = [
            smileEmoji,
            thumbsupEmoji,
        ];

        const emojiRow = [{
            index: 0,
            type: 'emojisRow',
            items: [
                {
                    categoryIndex: 0,
                    categoryName: 'recent',
                    emojiIndex: 0,
                    emojiId: smileEmoji.unified,
                    item: smileEmoji,
                },
                {
                    categoryIndex: 0,
                    categoryName: 'recent',
                    emojiIndex: 1,
                    emojiId: thumbsupEmoji.unified,
                    item: thumbsupEmoji,
                },
            ],
        }];

        expect(splitEmojisToRows(emojis as any, 0, 'recent', 0)).toEqual([emojiRow, 1]);
    });

    test('Should create only more than one row when passed emojis are more than emoji_per_row', () => {
        const emojis = [
            smileEmoji,
            thumbsupEmoji,
            thumbsdownEmoji,
            smileEmoji,
            thumbsupEmoji,
            thumbsdownEmoji,
            smileEmoji,
            thumbsupEmoji,
            thumbsdownEmoji,
            smileEmoji,
        ];

        expect(splitEmojisToRows(emojis as any, 0, 'recent', 0)[1]).toEqual(2);
    });
});

describe('createEmojisPositions', () => {
    test('Should not create emoji positions for category header row', () => {
        const categoryOrEmojiRows = [{
            index: 1,
            type: 'categoryHeaderRow',
        }];

        expect(createEmojisPositions(categoryOrEmojiRows as any)).toEqual([]);
    });

    test('Should create emoji positions correctly', () => {
        const categoryOrEmojiRows = [
            {
                index: 0,
                type: 'categoryHeaderRow',
            },
            {
                index: 1,
                type: 'emojisRow',
                items: [
                    {
                        categoryIndex: 0,
                        categoryName: 'recent',
                        emojiIndex: 0,
                        emojiId: smileEmoji.unified,
                        item: smileEmoji,
                    },
                    {
                        categoryIndex: 0,
                        categoryName: 'recent',
                        emojiIndex: 1,
                        emojiId: thumbsupEmoji.unified,
                        item: thumbsupEmoji,
                    },
                ],
            },
        ];

        expect(createEmojisPositions(categoryOrEmojiRows as any).length).toBe(2);

        expect(createEmojisPositions(categoryOrEmojiRows as any)).toEqual([
            {
                rowIndex: 1,
                emojiId: smileEmoji.unified,
                categoryName: 'recent',
            },
            {
                rowIndex: 1,
                emojiId: thumbsupEmoji.unified,
                categoryName: 'recent',
            },
        ]);
    });
});

describe('createCategoryAndEmojiRows', () => {
    test('Should return empty for no categories or emojis', () => {
        const categories = {
            recent: recentCategory,
        };

        expect(createCategoryAndEmojiRows([] as any, categories as any, '', '')).toEqual([[], []]);

        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
        };
        expect(createCategoryAndEmojiRows(allEmojis as any, [] as any, '', '')).toEqual([[], []]);
    });

    test('Should return search results on filter is on', () => {
        const allEmojis = {
            smile: smileEmoji,
            thumbsup: thumbsupEmoji,
            thumbsdown: thumbsdownEmoji,
        };

        const categories = {
            recent: {...recentCategory, emojiIds: ['thumbsup']},
            'people-body': {
                id: 'people-body',
                name: 'people-body',
                emojiIds: ['smile', 'thumbsup', 'thumbsdown'],
            },
        };

        const categoryAndEmojiRows = [
            {
                index: 0,
                type: 'categoryHeaderRow',
                items: [{
                    categoryIndex: 0,
                    categoryName: 'searchResults',
                    emojiId: '',
                    emojiIndex: -1,
                    item: undefined,
                }],
            },
            {
                index: 1,
                type: 'emojisRow',
                items: [
                    {
                        categoryIndex: 0,
                        categoryName: 'searchResults',
                        emojiIndex: 0,
                        emojiId: thumbsupEmoji.unified,
                        item: thumbsupEmoji,
                    },
                    {
                        categoryIndex: 0,
                        categoryName: 'searchResults',
                        emojiIndex: 1,
                        emojiId: thumbsdownEmoji.unified,
                        item: thumbsdownEmoji,
                    },
                ],
            },
        ];

        const emojiPositions = [
            {
                rowIndex: 1,
                emojiId: thumbsupEmoji.unified,
                categoryName: 'searchResults',
            },
            {
                rowIndex: 1,
                emojiId: thumbsdownEmoji.unified,
                categoryName: 'searchResults',
            },
        ];

        expect(createCategoryAndEmojiRows(allEmojis as any, categories as any, 'thumbs', '')).toEqual([categoryAndEmojiRows, emojiPositions]);
    });

    test('Should construct correct category and emoji rows along with emoji positions', () => {
        const allEmojis = {
            hundred: hundredEmoji,
            ok: okEmoji,
        };

        const categories = {
            'people-body': {
                id: 'people-body',
                name: 'people-body',
                emojiIds: ['hundred', 'ok'],
            },
        };

        expect(createCategoryAndEmojiRows(allEmojis as any, categories as any, '', '')[0]).toEqual([
            {
                index: 0,
                type: 'categoryHeaderRow',
                items: [{
                    categoryIndex: 0,
                    categoryName: 'people-body',
                    emojiId: '',
                    emojiIndex: -1,
                    item: undefined,
                }],
            },
            {
                index: 1,
                type: 'emojisRow',
                items: [
                    {
                        categoryIndex: 0,
                        categoryName: 'people-body',
                        emojiIndex: 0,
                        emojiId: hundredEmoji.unified,
                        item: hundredEmoji,
                    },
                    {
                        categoryIndex: 0,
                        categoryName: 'people-body',
                        emojiIndex: 1,
                        emojiId: okEmoji.unified,
                        item: okEmoji,
                    },
                ],
            },
        ]);

        expect(createCategoryAndEmojiRows(allEmojis as any, categories as any, '', '')[1]).toEqual([
            {
                rowIndex: 1,
                emojiId: hundredEmoji.unified,
                categoryName: 'people-body',
            },
            {
                rowIndex: 1,
                emojiId: okEmoji.unified,
                categoryName: 'people-body',
            },
        ]);
    });
});
