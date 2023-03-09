// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type EmojiCategory =
    | 'recent'
    | 'searchResults'
    | 'smileys-emotion'
    | 'people-body'
    | 'animals-nature'
    | 'food-drink'
    | 'activities'
    | 'travel-places'
    | 'objects'
    | 'symbols'
    | 'flags'
    | 'custom';

export type CustomEmoji = {
    id: string;
    name: string;
    category: 'custom';
    create_at: number;
    update_at: number;
    delete_at: number;
    creator_id: string;
};

export type SystemEmoji = {
    name: string;
    category: EmojiCategory;
    image: string;
    short_name: string;
    short_names: string[];
    batch: number;
    skins?: string[];
    skin_variations?: Record<string, SystemEmojiVariation>;
    unified: string;
};

export type SystemEmojiVariation = {
    unified: string;
    non_qualified: null;
    image: string;
    sheet_x: number;
    sheet_y: number;
    added_in: string;
    has_img_apple: boolean;
    has_img_google: boolean;
    has_img_twitter: boolean;
    has_img_facebook: boolean;
}

export type Emoji = SystemEmoji | CustomEmoji;

export type EmojisState = {
    customEmoji: {
        [x: string]: CustomEmoji;
    };
    nonExistentEmoji: Set<string>;
};

export type RecentEmojiData = {
    name: string;
    usageCount: number;
};
