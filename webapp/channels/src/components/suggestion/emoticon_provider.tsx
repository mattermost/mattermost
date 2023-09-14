// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Emoji} from '@mattermost/types/emojis';

import {autocompleteCustomEmojis} from 'mattermost-redux/actions/emojis';
import {getEmojiImageUrl, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import {getEmojiMap, getRecentEmojisNames} from 'selectors/emojis';
import store from 'stores/redux_store.jsx';

import {Preferences} from 'utils/constants';
import {compareEmojis, emojiMatchesSkin} from 'utils/emoji_utils';
import * as Emoticons from 'utils/emoticons';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import {SuggestionContainer} from './suggestion';
import type {SuggestionProps} from './suggestion';

export const MIN_EMOTICON_LENGTH = 2;
export const EMOJI_CATEGORY_SUGGESTION_BLOCKLIST = ['skintone'];

type EmojiItem = {
    name: string;
    emoji: Emoji;
    type: string;
}

const EmoticonSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<EmojiItem>>((props, ref) => {
    const text = props.term;
    const emoji = props.item.emoji;

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            <div className='pull-left'>
                <img
                    alt={text}
                    className='emoticon-suggestion__image'
                    src={getEmojiImageUrl(emoji)}
                    title={text}
                />
            </div>
            <div className='pull-left'>
                {text}
            </div>
        </SuggestionContainer>
    );
});
EmoticonSuggestion.displayName = 'EmoticonSuggestion';

export default class EmoticonProvider extends Provider {
    constructor() {
        super();

        this.triggerCharacter = ':';
    }

    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<EmojiItem>) {
        // Look for the potential emoticons at the start of the text, after whitespace, and at the start of emoji reaction commands
        const captured = (/(^|\s|^\+|^-)(:([^:\s]*))$/g).exec(pretext.toLowerCase());
        if (!captured) {
            return false;
        }

        const prefix = captured[1];
        const text = captured[2];
        const partialName = captured[3];

        if (partialName.length < MIN_EMOTICON_LENGTH) {
            return false;
        }

        // Check for text emoticons if this isn't for an emoji reaction
        if (prefix !== '-' && prefix !== '+') {
            for (const emoticon of Object.keys(Emoticons.emoticonPatterns)) {
                if (Emoticons.emoticonPatterns[emoticon].test(text)) {
                    // Don't show the autocomplete for text emoticons
                    return false;
                }
            }
        }

        if (store.getState().entities.general.config.EnableCustomEmoji === 'true') {
            store.dispatch(autocompleteCustomEmojis(partialName)).then(() => this.findAndSuggestEmojis(text, partialName, resultsCallback));
        } else {
            this.findAndSuggestEmojis(text, partialName, resultsCallback);
        }

        return true;
    }

    formatEmojis(emojis: EmojiItem[]) {
        return emojis.map((item) => ':' + item.name + ':');
    }

    // findAndSuggestEmojis uses the provided partialName to match anywhere inside an emoji name.
    //
    // For example, typing `:welc` would match both `:welcome:` and `:youre_welcome:` if those
    // emojis are present in the local store. Note, however, that the server only does prefix
    // matches, so a query to populate the local store for `:welc` would only return `:welcome:`.
    // This results in surprising differences between a fresh load of the application, and the
    // changes to the cache from expanding the cache with emojis found in existing posts.
    //
    // For now, this behaviour and difference is by design.
    // See https://mattermost.atlassian.net/browse/MM-17320.
    findAndSuggestEmojis(text: string, partialName: string, resultsCallback: ResultsCallback<EmojiItem>) {
        const recentMatched: EmojiItem[] = [];
        const matched: EmojiItem[] = [];
        const state = store.getState();
        const skintone = state.entities?.preferences?.myPreferences['emoji--emoji_skintone']?.value || 'default';
        const emojiMap = getEmojiMap(state);
        const recentEmojis = getRecentEmojisNames(state);

        // Check for named emoji
        for (const [name, emoji] of emojiMap) {
            if (EMOJI_CATEGORY_SUGGESTION_BLOCKLIST.includes(emoji.category)) {
                continue;
            }

            if (isSystemEmoji(emoji)) {
                // This is a system emoji so it may have multiple names
                for (const alias of emoji.short_names) {
                    if (alias.indexOf(partialName) !== -1) {
                        const matchedArray = recentEmojis.includes(alias) || recentEmojis.includes(name) ? recentMatched : matched;

                        // if the emoji has skin, only add those that match with the user selected skin.
                        if (emojiMatchesSkin(emoji, skintone)) {
                            matchedArray.push({name: alias, emoji, type: Preferences.CATEGORY_EMOJI});
                        }
                        break;
                    }
                }
            } else if (name.indexOf(partialName) !== -1) {
                // This is a custom emoji so it only has one name
                if (emojiMap.hasSystemEmoji(name)) {
                    // System emojis take precedence over custom ones
                    continue;
                }

                const matchedArray = recentEmojis.includes(name) ? recentMatched : matched;

                matchedArray.push({name, emoji, type: Preferences.CATEGORY_EMOJI});
            }
        }

        const sortEmojisHelper = (a: EmojiItem, b: EmojiItem) => {
            return compareEmojis(a.emoji, b.emoji, partialName);
        };

        recentMatched.sort(sortEmojisHelper);

        matched.sort(sortEmojisHelper);

        const terms = [
            ...this.formatEmojis(recentMatched),
            ...this.formatEmojis(matched),
        ];

        const items = [
            ...recentMatched,
            ...matched,
        ];

        // Required to get past the dispatch during dispatch error
        resultsCallback({
            matchedPretext: text,
            terms,
            items,
            component: EmoticonSuggestion,
        });
    }
}
