// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import emojiRegex from 'emoji-regex';
import React from 'react';

import {Emoji, SystemEmoji} from '@mattermost/types/emojis';

import {EmojiIndicesByUnicode, Emojis} from 'utils/emoji';

const defaultRule = (aName: string, bName: string, emojiA: Emoji, emojiB: Emoji) => {
    if (emojiA.category === 'custom' && emojiB.category !== 'custom') {
        return 1;
    } else if (emojiB.category === 'custom' && emojiA.category !== 'custom') {
        return -1;
    }

    return aName.localeCompare(bName);
};

const thumbsDownRule = (otherName: string) => {
    if (otherName === 'thumbsup' || otherName === '+1') {
        return 1;
    }
    return 0;
};

const thumbsUpRule = (otherName: string) => {
    if (otherName === 'thumbsdown' || otherName === '-1') {
        return -1;
    }
    return 0;
};

const customRules: Record<string, (emojiName: string) => number> = {
    thumbsdown: thumbsDownRule,
    '-1': thumbsDownRule,
    thumbsup: thumbsUpRule,
    '+1': thumbsUpRule,
};

const getEmojiName = (emoji: Emoji, searchedName: string) => {
    // There's an edge case for custom emojis that start with a thumb prefix.
    // It doesn't match the first alias for the relevant system emoji.
    // We don't have control over the names or aliases of custom emojis...
    // ... and how they compare to the relevant system ones.
    // So we need to search for a matching alias in the whole array.
    // E.g. thumbsup-custom vs [+1, thumbsup]
    if (!emoji) {
        return '';
    }

    // does it have aliases?
    if (searchedName && 'short_names' in emoji) {
        return emoji.short_names.find((alias: string) => alias.startsWith(searchedName)) || emoji.short_name;
    }

    return 'short_name' in emoji ? emoji.short_name : emoji.name;
};

export function compareEmojis(emojiA: Emoji, emojiB: Emoji, searchedName: string) {
    const aName = getEmojiName(emojiA, searchedName);
    const bName = getEmojiName(emojiB, searchedName);

    // Have the emojis that starts with the search appear first
    const aPrefix = aName.startsWith(searchedName);
    const bPrefix = bName.startsWith(searchedName);

    if (aPrefix === bPrefix) {
        if (aName in customRules) {
            return customRules[aName](bName) || defaultRule(aName, bName, emojiA, emojiB);
        }

        return defaultRule(aName, bName, emojiA, emojiB);
    } else if (aPrefix) {
        return -1;
    }

    return 1;
}

// wrapEmojis takes a text string and returns it with any Unicode emojis wrapped by a span with the emoji class.
export function wrapEmojis(text: string): React.ReactNode {
    const nodes = [];

    let lastIndex = 0;

    // Manually split the string into an array of strings and spans wrapping individual emojis
    for (const match of text.matchAll(emojiRegex())) {
        const emoji = match[0];
        const index = match.index!;

        if (match.index !== lastIndex) {
            nodes.push(text.substring(lastIndex, index));
        }

        nodes.push(
            <span
                key={index}
                className='emoji'
            >
                {emoji}
            </span>,
        );

        // Remember that emojis can be multiple code points long when incrementing the index
        lastIndex = index + emoji.length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.substring(lastIndex));
    }

    // Only return an array if we're returning multiple nodes
    return nodes.length === 1 ? nodes[0] : nodes;
}

// Note : This function is not an idea implementation, a more better and efficeint way to do this come when we make changes to emoji json.
export function convertEmojiSkinTone(emoji: SystemEmoji, newSkinTone: string): SystemEmoji {
    let newEmojiId = '';

    if (!emoji.skins && !emoji.skin_variations) {
        // Don't change the skin tone of an emoji without skin tone variations
        return emoji;
    }

    if (emoji.skins && emoji.skins.length > 1) {
        // Don't change the skin tone of emojis affected by multiple skin tones
        return emoji;
    }

    const currentSkinTone = getSkin(emoji);

    // If its a default (yellow) emoji, get the skin variation from its property
    if (currentSkinTone === 'default') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const variation = Object.keys(emoji?.skin_variations).find((skinVariation) => skinVariation.includes(newSkinTone));

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        newEmojiId = variation ? emoji.skin_variations[variation].unified : emoji.unified;
    } else if (newSkinTone === 'default') {
        // If default (yellow) skin is selected, remove the skin code from emoji id
        newEmojiId = emoji.unified.replaceAll(/-(1F3FB|1F3FC|1F3FD|1F3FE|1F3FF)/g, '');
    } else {
        // If non default skin is selected, add the new skin selected code to emoji id
        newEmojiId = emoji.unified.replaceAll(/(1F3FB|1F3FC|1F3FD|1F3FE|1F3FF)/g, newSkinTone);
    }

    let emojiIndex = EmojiIndicesByUnicode.get(newEmojiId.toLowerCase()) as number;
    let newEmoji = Emojis[emojiIndex];

    if (!newEmoji) {
        // The emoji wasn't found, possibly because it needs a variation selector appended (FE0F) appended for some reason.
        // This is needed for certain emojis like point_up which is 261d-fe0f instead of just 261d
        emojiIndex = EmojiIndicesByUnicode.get(newEmojiId.toLowerCase() + '-fe0f') as number;
        newEmoji = Emojis[emojiIndex];
    }

    return newEmoji ?? emoji;
}

// if an emoji
// - has `skin_variations` then it uses the default skin (yellow)
// - has `skins` it's first value is considered the skin version (it can contain more values)
// - any other case it doesn't have variations or is a custom emoji.
export function getSkin(emoji: Emoji) {
    if ('skin_variations' in emoji) {
        return 'default';
    }
    if ('skins' in emoji) {
        const skin = emoji?.skins?.[0] ?? '';

        if (skin.length !== 0) {
            return skin;
        }
    }
    return null;
}

export function emojiMatchesSkin(emoji: Emoji, skin: string) {
    const emojiSkin = getSkin(emoji);
    return !emojiSkin || emojiSkin === skin;
}
