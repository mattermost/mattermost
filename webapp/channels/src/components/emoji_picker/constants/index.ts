// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import {
    AccountOutlineIcon,
    AirplaneVariantIcon,
    BasketballIcon,
    ClockOutlineIcon,
    EmoticonCustomOutlineIcon,
    EmoticonHappyOutlineIcon,
    FlagOutlineIcon,
    FoodAppleIcon,
    HeartOutlineIcon,
    LeafOutlineIcon,
    LightbulbOutlineIcon,
    MagnifyIcon,
} from '@mattermost/compass-icons/components';
import type {EmojiCategory} from '@mattermost/types/emojis';

import type {Categories} from '../types';

export const RECENT: EmojiCategory = 'recent' as const;
export const SEARCH_RESULTS: EmojiCategory = 'searchResults' as const;
export const SMILEY_EMOTION: EmojiCategory = 'smileys-emotion' as const;
export const CUSTOM: EmojiCategory = 'custom' as const;

export const EMOJI_CATEGORIES: Categories = {
    recent: {
        name: 'recent',
        label: defineMessage({
            id: 'emoji_picker.recent',
            defaultMessage: 'Recently Used',
        }),
        icon: ClockOutlineIcon,
    },
    searchResults: {
        name: 'searchResults',
        label: defineMessage({
            id: 'emoji_picker.searchResults',
            defaultMessage: 'Search Results',
        }),
        icon: MagnifyIcon,
    },
    'smileys-emotion': {
        name: 'smileys-emotion',
        label: defineMessage({
            id: 'emoji_picker.smileys-emotion',
            defaultMessage: 'Smileys & Emotion',
        }),
        icon: EmoticonHappyOutlineIcon,
    },
    'people-body': {
        name: 'people-body',
        label: defineMessage({
            id: 'emoji_picker.people-body',
            defaultMessage: 'People & Body',
        }),
        icon: AccountOutlineIcon,
    },
    'animals-nature': {
        name: 'animals-nature',
        label: defineMessage({
            id: 'emoji_picker.animals-nature',
            defaultMessage: 'Animals & Nature',
        }),
        icon: LeafOutlineIcon,
    },
    'food-drink': {
        name: 'food-drink',
        label: defineMessage({
            id: 'emoji_picker.food-drink',
            defaultMessage: 'Food & Drink',
        }),
        icon: FoodAppleIcon,
    },
    'travel-places': {
        name: 'travel-places',
        label: defineMessage({
            id: 'emoji_picker.travel-places',
            defaultMessage: 'Travel & Places',
        }),
        icon: AirplaneVariantIcon,
    },
    activities: {
        name: 'activities',
        label: defineMessage({
            id: 'emoji_picker.activities',
            defaultMessage: 'Activities',
        }),
        icon: BasketballIcon,
    },
    objects: {
        name: 'objects',
        label: defineMessage({
            id: 'emoji_picker.objects',
            defaultMessage: 'Objects',
        }),
        icon: LightbulbOutlineIcon,
    },
    symbols: {
        name: 'symbols',
        label: defineMessage({
            id: 'emoji_picker.symbols',
            defaultMessage: 'Symbols',
        }),
        icon: HeartOutlineIcon,
    },
    flags: {
        name: 'flags',
        label: defineMessage({
            id: 'emoji_picker.flags',
            defaultMessage: 'Flags',
        }),
        icon: FlagOutlineIcon,
    },
    custom: {
        name: 'custom',
        label: defineMessage({
            id: 'emoji_picker.custom',
            defaultMessage: 'Custom',
        }),
        icon: EmoticonCustomOutlineIcon,
    },
} as const;

const {recent, searchResults, ...standardCategories} = EMOJI_CATEGORIES;

export const RECENT_EMOJI_CATEGORY: Pick<Categories, typeof RECENT> = {recent};
export const SEARCH_EMOJI_CATEGORY: Pick<Categories, typeof SEARCH_RESULTS> = {searchResults};

// TODO CATEGORIES doesn't contain 'recent' or 'searchResults' as it's type claims
export const CATEGORIES = standardCategories as Categories;

export const EMOJI_PER_ROW = 9; // needs to match variable `$emoji-per-row` in _variables.scss
export const ITEM_HEIGHT = 36; //as per .emoji-picker__item height in _emoticons.scss
export const EMOJI_CONTAINER_HEIGHT = 290; // If this changes, the spaceRequiredAbove and spaceRequiredBelow props passed to the EmojiPickerOverlay must be updated
export const CATEGORIES_CONTAINER_HEIGHT = 36; // height of categories container (28px) + margin (8px)

export const CATEGORY_HEADER_ROW = 'categoryHeaderRow';
export const EMOJIS_ROW = 'emojisRow';

export const EMOJI_SCROLL_THROTTLE_DELAY = 150;
export const EMOJI_ROWS_OVERSCAN_COUNT = 1;

export const CUSTOM_EMOJIS_PER_PAGE = 200;
export const CUSTOM_EMOJI_SEARCH_THROTTLE_TIME_MS = 1000;
