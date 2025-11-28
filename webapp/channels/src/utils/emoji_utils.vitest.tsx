// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {EmojiIndicesByAlias, Emojis} from 'utils/emoji';
import {TestHelper as TH} from 'utils/test_helper';

import {compareEmojis, convertEmojiSkinTone, wrapEmojis} from './emoji_utils';

describe('compareEmojis', () => {
    test('should sort an array of emojis alphabetically', () => {
        const goatEmoji = TH.getCustomEmojiMock({
            name: 'goat',
        });

        const dashEmoji = TH.getCustomEmojiMock({
            name: 'dash',
        });

        const smileEmoji = TH.getCustomEmojiMock({
            name: 'smile',
        });

        const emojiArray = [goatEmoji, dashEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, ''));

        expect(emojiArray).toEqual([dashEmoji, goatEmoji, smileEmoji]);
    });

    test('should have partial matched emoji first', () => {
        const goatEmoji = TH.getSystemEmojiMock({
            short_name: 'goat',
            short_names: ['goat'],
        });

        const dashEmoji = TH.getSystemEmojiMock({
            short_name: 'dash',
            short_names: ['dash'],
        });

        const smileEmoji = TH.getSystemEmojiMock({
            short_name: 'smile',
            short_names: ['smile'],
        });

        const emojiArray = [goatEmoji, dashEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, 'smi'));

        expect(emojiArray).toEqual([smileEmoji, dashEmoji, goatEmoji]);
    });

    test('should be able to sort on aliases', () => {
        const goatEmoji = TH.getSystemEmojiMock({
            short_names: [':goat:'],
            short_name: ':goat:',
        });

        const dashEmoji = TH.getSystemEmojiMock({
            short_names: [':dash:'],
            short_name: ':dash:',
        });

        const smileEmoji = TH.getSystemEmojiMock({
            short_names: [':smile:'],
            short_name: ':smile:',
        });

        const emojiArray = [goatEmoji, dashEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, ''));

        expect(emojiArray).toEqual([dashEmoji, goatEmoji, smileEmoji]);
    });

    test('special case for thumbsup emoji should sort it before thumbsdown by aliases', () => {
        const thumbsUpEmoji = TH.getSystemEmojiMock({
            short_names: ['+1'],
            short_name: '+1',
        });

        const thumbsDownEmoji = TH.getSystemEmojiMock({
            short_names: ['-1'],
            short_name: '-1',
        });

        const smileEmoji = TH.getSystemEmojiMock({
            short_names: ['smile'],
            short_name: 'smile',
        });

        const emojiArray = [thumbsDownEmoji, thumbsUpEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, ''));

        expect(emojiArray).toEqual([thumbsUpEmoji, thumbsDownEmoji, smileEmoji]);
    });

    test('special case for thumbsup emoji should sort it before thumbsdown by names', () => {
        const thumbsUpEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsup',
        });

        const thumbsDownEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsdown',
        });

        const smileEmoji = TH.getSystemEmojiMock({
            short_name: 'smile',
        });

        const emojiArray = [thumbsDownEmoji, thumbsUpEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, ''));

        expect(emojiArray).toEqual([smileEmoji, thumbsUpEmoji, thumbsDownEmoji]);
    });

    test('special case for thumbsup emoji should sort it when emoji is matched', () => {
        const thumbsUpEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsup',
        });

        const thumbsDownEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsdown',
        });

        const smileEmoji = TH.getSystemEmojiMock({
            short_name: 'smile',
        });

        const emojiArray = [thumbsDownEmoji, thumbsUpEmoji, smileEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, 'thumb'));

        expect(emojiArray).toEqual([thumbsUpEmoji, thumbsDownEmoji, smileEmoji]);
    });

    test('special case for thumbsup emoji should sort custom "thumb" emojis after system', () => {
        const thumbsUpEmoji = TH.getSystemEmojiMock({
            short_names: ['+1', 'thumbsup'],
            category: 'people-body',
        });

        const thumbsDownEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsdown',
            category: 'people-body',
        });

        const thumbsUpCustomEmoji = TH.getSystemEmojiMock({
            short_name: 'thumbsup-custom',
            category: 'custom',
        });

        const emojiArray = [thumbsUpCustomEmoji, thumbsDownEmoji, thumbsUpEmoji];
        emojiArray.sort((a, b) => compareEmojis(a, b, 'thumb'));

        expect(emojiArray).toEqual([thumbsUpEmoji, thumbsDownEmoji, thumbsUpCustomEmoji]);
    });
});

describe('wrapEmojis', () => {
    // Note that the keys used by some of these may appear to be incorrect because they're counting Unicode code points
    // instead of just characters. Also, if these tests return results that serialize to the same string, that means
    // that the key for a span is incorrect.

    test('should return the original string if it contains no emojis', () => {
        const input = 'this is a test 1234';

        expect(wrapEmojis(input)).toBe(input);
    });

    test('should wrap a single emoji in a span', () => {
        const input = '🌮';

        expect(wrapEmojis(input)).toEqual(
            <span
                key='0'
                className='emoji'
            >
                {'🌮'}
            </span>,
        );
    });

    test('should wrap a single emoji in a span with surrounding text', () => {
        const input = 'this is 🌮 a test 1234';

        expect(wrapEmojis(input)).toEqual([
            'this is ',
            <span
                key='8'
                className='emoji'
            >
                {'🌮'}
            </span>,
            ' a test 1234',
        ]);
    });

    test('should wrap multiple emojis in spans', () => {
        const input = 'this is 🌮 a taco 🎉 1234';

        expect(wrapEmojis(input)).toEqual([
            'this is ',
            <span
                key='8'
                className='emoji'
            >
                {'🌮'}
            </span>,
            ' a taco ',
            <span
                key='18'
                className='emoji'
            >
                {'🎉'}
            </span>,
            ' 1234',
        ]);
    });

    test('should return a one character string if it contains no emojis', () => {
        const input = 'a';

        expect(wrapEmojis(input)).toBe(input);
    });

    test('should properly wrap an emoji followed by a single character', () => {
        const input = '🌮a';

        expect(wrapEmojis(input)).toEqual([
            <span
                key='0'
                className='emoji'
            >
                {'🌮'}
            </span>,
            'a',
        ]);
    });
});

describe('convertEmojiSkinTone', () => {
    test('should convert a default skin toned emoji', () => {
        const emoji = getEmoji('nose');

        expect(convertEmojiSkinTone(emoji, 'default')).toBe(getEmoji('nose'));
        expect(convertEmojiSkinTone(emoji, '1F3FB')).toBe(getEmoji('nose_light_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FC')).toBe(getEmoji('nose_medium_light_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FD')).toBe(getEmoji('nose_medium_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FE')).toBe(getEmoji('nose_medium_dark_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FF')).toBe(getEmoji('nose_dark_skin_tone'));
    });

    test('should convert a non-default skin toned emoji', () => {
        const emoji = getEmoji('ear_dark_skin_tone');

        expect(convertEmojiSkinTone(emoji, 'default')).toBe(getEmoji('ear'));
        expect(convertEmojiSkinTone(emoji, '1F3FB')).toBe(getEmoji('ear_light_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FC')).toBe(getEmoji('ear_medium_light_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FD')).toBe(getEmoji('ear_medium_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FE')).toBe(getEmoji('ear_medium_dark_skin_tone'));
        expect(convertEmojiSkinTone(emoji, '1F3FF')).toBe(getEmoji('ear_dark_skin_tone'));
    });

    test('should do nothing for emojis without skin tones', () => {
        const strawberry = getEmoji('strawberry');

        expect(convertEmojiSkinTone(strawberry, 'default')).toBe(strawberry);
        expect(convertEmojiSkinTone(strawberry, '1F3FB')).toBe(strawberry);
        expect(convertEmojiSkinTone(strawberry, '1F3FC')).toBe(strawberry);
        expect(convertEmojiSkinTone(strawberry, '1F3FD')).toBe(strawberry);
        expect(convertEmojiSkinTone(strawberry, '1F3FE')).toBe(strawberry);
        expect(convertEmojiSkinTone(strawberry, '1F3FF')).toBe(strawberry);
    });
});

function getEmoji(name: string) {
    return Emojis[EmojiIndicesByAlias.get(name)!];
}
