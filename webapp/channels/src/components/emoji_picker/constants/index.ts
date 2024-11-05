// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import type {EmojiCategory} from '@mattermost/types/emojis';

import * as Emoji from 'utils/emoji';

import type {Category, Categories} from '../types';

export const RECENT = 'recent';
export const SEARCH_RESULTS = 'searchResults';
export const SMILEY_EMOTION = 'smileys-emotion';
export const CUSTOM = 'custom';

const emojiCategories = {
    recent: {
        name: 'recent',
        label: defineMessage({
            id: 'emoji_picker.recent',
            defaultMessage: 'Recent',
        }),
        iconClassName: 'icon-clock-outline',
    },
    searchResults: {
        name: 'searchResults',
        label: defineMessage({
            id: 'emoji_picker.searchResults',
            defaultMessage: 'Search Results',
        }),
        iconClassName: '',
    },
    'smileys-emotion': {
        name: 'smileys-emotion',
        label: defineMessage({
            id: 'emoji_picker.smileys-emotion',
            defaultMessage: 'Smileys & Emotion',
        }),
        iconClassName: 'icon-emoticon-happy-outline',
    },
    'people-body': {
        name: 'people-body',
        label: defineMessage({
            id: 'emoji_picker.people-body',
            defaultMessage: 'People & Body',
        }),
        iconClassName: 'icon-account-outline',
    },
    'animals-nature': {
        name: 'animals-nature',
        label: defineMessage({
            id: 'emoji_picker.animals-nature',
            defaultMessage: 'Animals & Nature',
        }),
        iconClassName: 'icon-leaf-outline',
    },
    'food-drink': {
        name: 'food-drink',
        label: defineMessage({
            id: 'emoji_picker.food-drink',
            defaultMessage: 'Food & Drink',
        }),
        iconClassName: 'icon-food-apple',
    },
    'travel-places': {
        name: 'travel-places',
        label: defineMessage({
            id: 'emoji_picker.travel-places',
            defaultMessage: 'Travel & Places',
        }),
        iconClassName: 'icon-airplane-variant',
    },
    activities: {
        name: 'activities',
        label: defineMessage({
            id: 'emoji_picker.activities',
            defaultMessage: 'Activities',
        }),
        iconClassName: 'icon-basketball',
    },
    objects: {
        name: 'objects',
        label: defineMessage({
            id: 'emoji_picker.objects',
            defaultMessage: 'Objects',
        }),
        iconClassName: 'icon-lightbulb-outline',
    },
    symbols: {
        name: 'symbols',
        label: defineMessage({
            id: 'emoji_picker.symbols',
            defaultMessage: 'Symbols',
        }),
        iconClassName: 'icon-heart-outline',
    },
    flags: {
        name: 'flags',
        label: defineMessage({
            id: 'emoji_picker.flags',
            defaultMessage: 'Flags',
        }),
        iconClassName: 'icon-flag-outline',
    },
    custom: {
        name: 'custom',
        label: defineMessage({
            id: 'emoji_picker.custom',
            defaultMessage: 'Custom',
        }),
        iconClassName: 'icon-emoticon-custom-outline',
    },
} satisfies Record<EmojiCategory, Category>;

export const RECENT_EMOJI_CATEGORY: Pick<Categories, 'recent'> = {recent: emojiCategories.recent};
export const SEARCH_EMOJI_CATEGORY: Pick<Categories, typeof SEARCH_RESULTS> = {searchResults: emojiCategories.searchResults};

export const CATEGORIES: Categories = Emoji.CategoryNames.
    filter((category) => !(category === 'recent' || category === 'searchResults')).
    reduce((previousCategory, currentCategory) => {
        return {
            ...previousCategory,
            [currentCategory]: emojiCategories[currentCategory as EmojiCategory],
        };
    }, {} as Categories);

export const EMOJI_PER_ROW = 9; // needs to match variable `$emoji-per-row` in _variables.scss
export const ITEM_HEIGHT = 36; //as per .emoji-picker__item height in _emoticons.scss
export const EMOJI_CONTAINER_HEIGHT = 290; // If this changes, the spaceRequiredAbove and spaceRequiredBelow props passed to the EmojiPickerOverlay must be updated

export const CATEGORY_HEADER_ROW = 'categoryHeaderRow';
export const EMOJIS_ROW = 'emojisRow';

export const EMOJI_SCROLL_THROTTLE_DELAY = 150;
export const EMOJI_ROWS_OVERSCAN_COUNT = 1;

export const CUSTOM_EMOJIS_PER_PAGE = 200;
export const CUSTOM_EMOJI_SEARCH_THROTTLE_TIME_MS = 1000;
