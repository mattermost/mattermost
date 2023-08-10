// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import type {Emoji, SystemEmoji, CustomEmoji} from '@mattermost/types/emojis';

export function isSystemEmoji(emoji: Emoji): emoji is SystemEmoji {
    if ('category' in emoji) {
        return emoji.category !== 'custom';
    }

    return !('id' in emoji);
}

export function getEmojiImageUrl(emoji: Emoji): string {
    // If its the mattermost custom emoji
    if (!isSystemEmoji(emoji) && emoji.id === 'mattermost') {
        return Client4.getSystemEmojiImageUrl('mattermost');
    }

    if (isSystemEmoji(emoji)) {
        const emojiUnified = emoji?.unified?.toLowerCase() ?? '';
        const filename = emojiUnified || emoji.short_names[0];

        return Client4.getSystemEmojiImageUrl(filename);
    }

    return Client4.getEmojiRoute(emoji.id) + '/image';
}

export function parseNeededCustomEmojisFromText(text: string, systemEmojis: Set<string>, customEmojisByName: Map<string, CustomEmoji>, nonExistentEmoji: Set<string>): Set<string> {
    if (!text.includes(':')) {
        return new Set();
    }

    const pattern = /:([A-Za-z0-9_-]+):/gi;
    const customEmojis = new Set<string>();
    let match;
    while ((match = pattern.exec(text)) !== null) {
        if (!match) {
            continue;
        }

        if (systemEmojis.has(match[1])) {
            // It's a system emoji, go the next match
            continue;
        }

        if (nonExistentEmoji.has(match[1])) {
            // We've previously confirmed this is not a custom emoji
            continue;
        }

        if (customEmojisByName.has(match[1])) {
            // We have the emoji, go to the next match
            continue;
        }

        customEmojis.add(match[1]);
    }

    return customEmojis;
}
