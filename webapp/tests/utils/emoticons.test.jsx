// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmojiStore from 'stores/emoji_store.jsx';
import * as Emoticons from 'utils/emoticons.jsx';

describe('Emoticons', () => {
    describe('handleEmoticons', () => {
        const emojis = EmojiStore.getEmojis();

        test('should replace emoticons with tokens', () => {
            expect(Emoticons.handleEmoticons(':goat: :dash:', new Map(), emojis)).
                toEqual('$MM_EMOTICON0 $MM_EMOTICON1');
        });

        test('should replace emoticons not separated by whitespace', () => {
            expect(Emoticons.handleEmoticons(':goat::dash:', new Map(), emojis)).
                toEqual('$MM_EMOTICON0$MM_EMOTICON1');
        });

        test('should replace emoticons separated by punctuation', () => {
            expect(Emoticons.handleEmoticons('/:goat:..:dash:)', new Map(), emojis)).
                toEqual('/$MM_EMOTICON0..$MM_EMOTICON1)');
        });

        test('should replace emoticons separated by text', () => {
            expect(Emoticons.handleEmoticons('asdf:goat:asdf:dash:asdf', new Map(), emojis)).
                toEqual('asdf$MM_EMOTICON0asdf$MM_EMOTICON1asdf');
        });

        test('shouldn\'t replace invalid emoticons', () => {
            expect(Emoticons.handleEmoticons(':asdf: :goat : : dash:', new Map(), emojis)).
                toEqual(':asdf: :goat : : dash:');
        });
    });
});
