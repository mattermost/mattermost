// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomEmoji, Emoji, SystemEmoji} from '@mattermost/types/emojis';

import {EmojiIndicesByAlias, EmojiIndicesByUnicode, Emojis} from 'utils/emoji';

// Wrap the contents of the store so that we don't need to construct an ES6 map where most of the content
// (the system emojis) will never change. It provides the get/has functions of a map and an iterator so
// that it can be used in for..of loops
export default class EmojiMap {
    public customEmojis: Map<string, CustomEmoji>; // This should probably be private
    private customEmojisArray: Array<[string, CustomEmoji]>;

    constructor(customEmojis: Map<string, CustomEmoji>) {
        this.customEmojis = customEmojis;

        // Store customEmojis to an array so we can iterate it more easily
        this.customEmojisArray = [...customEmojis];
    }

    has(name: string): boolean {
        return EmojiIndicesByAlias.has(name) || this.customEmojis.has(name);
    }

    hasSystemEmoji(name: string): boolean {
        return EmojiIndicesByAlias.has(name);
    }

    hasUnicode(codepoint: string): boolean {
        return EmojiIndicesByUnicode.has(codepoint);
    }

    get(name: string): Emoji | undefined {
        if (EmojiIndicesByAlias.has(name)) {
            return Emojis[EmojiIndicesByAlias.get(name) as number];
        }

        return this.customEmojis.get(name);
    }

    getUnicode(codepoint: string): SystemEmoji | undefined {
        return Emojis[EmojiIndicesByUnicode.get(codepoint) as number];
    }

    [Symbol.iterator](): Iterator<[string, Emoji]> {
        const customEmojisArray = this.customEmojisArray;

        let systemIndex = 0;
        let customIndex = 0;

        return {
            next(): IteratorResult<[string, Emoji]> {
                // We loop throgh system emojis first, by progressively incrementing systemIndex until we reach the end of system emojis array
                if (systemIndex < Emojis.length) {
                    const systemEmoji = Emojis[systemIndex] as SystemEmoji;

                    systemIndex += 1;

                    return {value: [systemEmoji.short_names[0], systemEmoji]};
                }

                // Then we loop through custom emojis
                if (customIndex < customEmojisArray.length) {
                    const customEmoji = customEmojisArray[customIndex][1] as CustomEmoji;

                    customIndex += 1;

                    return {value: [customEmoji.name, customEmoji]};
                }

                // When we have looped through all, we return done
                return {done: true, value: undefined};
            },
        };
    }
}
