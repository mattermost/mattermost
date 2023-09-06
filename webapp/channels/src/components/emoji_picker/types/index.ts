// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {EmojiCategory, Emoji, SystemEmoji, CustomEmoji} from '@mattermost/types/emojis';

import type {
    CATEGORY_HEADER_ROW,
    EMOJIS_ROW,
} from 'components/emoji_picker/constants';

export type Category = {
    className: string;
    emojiIds?: string[];
    id: string;
    message: string;
    name: EmojiCategory;
};

export type Categories = Record<EmojiCategory, Category>;

export type CategoryOrEmojiRow = CategoryHeaderRow | EmojiRow;

export type CategoryHeaderRow = {
    index: number;
    type: typeof CATEGORY_HEADER_ROW;
    items: Array<{
        categoryIndex: number;
        categoryName: EmojiCategory;
        emojiIndex: -1;
        emojiId: '';
        item: undefined;
    }>;
}

export type EmojiRow = {
    index: number;
    type: typeof EMOJIS_ROW;
    items: Array<{
        categoryIndex: number;
        categoryName: EmojiCategory;
        emojiIndex: number;
        emojiId: CustomEmoji['id'] | SystemEmoji['unified'];
        item: Emoji;
    }>;
}

export type EmojiCursor = {
    rowIndex: number;
    emojiId: CustomEmoji['id'] | SystemEmoji['unified'];
    emoji: Emoji | undefined;
};

export type EmojiPosition = {
    rowIndex: number;
    emojiId: CustomEmoji['id'] | SystemEmoji['unified'];
    categoryName: EmojiCategory;
}

export enum NavigationDirection {
    NextEmoji = 'next',
    PreviousEmoji = 'previous',
    NextEmojiRow = 'nextRow',
    PreviousEmojiRow = 'previousRow',
}
