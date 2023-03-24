// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as EmojiUtils from 'mattermost-redux/utils/emoji_utils';
import TestHelper from '../../test/test_helper';

describe('EmojiUtils', () => {
    describe('parseNeededCustomEmojisFromText', () => {
        it('no emojis', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                'This has no emojis',
                new Set(),
                new Map(),
                new Set(),
            );
            const expected = new Set([]);

            expect(actual).toEqual(expected);
        });

        it('some emojis', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                ':this: :is_all: :emo-jis: :123:',
                new Set(),
                new Map(),
                new Set(),
            );
            const expected = new Set(['this', 'is_all', 'emo-jis', '123']);

            expect(actual).toEqual(expected);
        });

        it('text surrounding emojis', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                ':this:/:is_all: (:emo-jis:) surrounding:123:text:456:asdf',
                new Set(),
                new Map(),
                new Set(),
            );
            const expected = new Set(['this', 'is_all', 'emo-jis', '123', '456']);

            expect(actual).toEqual(expected);
        });

        it('system emojis', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                ':this: :is_all: :emo-jis: :123:',
                new Set(['this', '123']),
                new Map(),
                new Set(),
            );
            const expected = new Set(['is_all', 'emo-jis']);

            expect(actual).toEqual(expected);
        });

        it('custom emojis', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                ':this: :is_all: :emo-jis: :123:',
                new Set(),
                new Map([['is_all', TestHelper.getCustomEmojiMock({name: 'is_all'})], ['emo-jis', TestHelper.getCustomEmojiMock({name: 'emo-jis'})]]),
                new Set(),
            );
            const expected = new Set(['this', '123']);

            expect(actual).toEqual(expected);
        });

        it('emojis that we\'ve already tried to load', () => {
            const actual = EmojiUtils.parseNeededCustomEmojisFromText(
                ':this: :is_all: :emo-jis: :123:',
                new Set(),
                new Map(),
                new Set(['this', 'emo-jis']),
            );
            const expected = new Set(['is_all', '123']);

            expect(actual).toEqual(expected);
        });
    });

    describe('isSystemEmoji', () => {
        test('correctly identifies system emojis with category', () => {
            const sampleEmoji = TestHelper.getSystemEmojiMock({
                unified: 'z1z1z1',
                name: 'sampleEmoji',
                category: 'activities',
                short_names: ['sampleEmoji'],
                short_name: 'sampleEmoji',
                batch: 2,
                image: 'sampleEmoji.png',
            });
            expect(EmojiUtils.isSystemEmoji(sampleEmoji)).toBe(true);
        });

        test('correctly identifies system emojis without category', () => {
            const sampleEmoji = TestHelper.getSystemEmojiMock({
                unified: 'z1z1z1',
                name: 'sampleEmoji',
                short_names: ['sampleEmoji'],
                short_name: 'sampleEmoji',
                batch: 2,
                image: 'sampleEmoji.png',
            });
            expect(EmojiUtils.isSystemEmoji(sampleEmoji)).toBe(true);
        });

        test('correctly identifies custom emojis with category and without id', () => {
            const sampleEmoji = TestHelper.getCustomEmojiMock({
                category: 'custom',
            });
            expect(EmojiUtils.isSystemEmoji(sampleEmoji)).toBe(false);
        });

        test('correctly identifies custom emojis without category and with id', () => {
            const sampleEmoji = TestHelper.getCustomEmojiMock({
                id: 'sampleEmoji',
            });
            expect(EmojiUtils.isSystemEmoji(sampleEmoji)).toBe(false);
        });

        test('correctly identifies custom emojis with category and with id', () => {
            const sampleEmoji = TestHelper.getCustomEmojiMock({
                id: 'sampleEmoji',
                category: 'custom',
            });
            expect(EmojiUtils.isSystemEmoji(sampleEmoji)).toBe(false);
        });
    });

    describe('getEmojiImageUrl', () => {
        test('returns correct url for system emojis', () => {
            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getSystemEmojiMock({unified: 'system_emoji'}))).toBe('/static/emoji/system_emoji.png');

            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getSystemEmojiMock({short_names: ['system_emoji_short_names']}))).toBe('/static/emoji/system_emoji_short_names.png');
        });

        test('return correct url for mattermost emoji', () => {
            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getCustomEmojiMock({id: 'mattermost', category: 'custom'}))).toBe('/static/emoji/mattermost.png');

            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getCustomEmojiMock({id: 'mattermost'}))).toBe('/static/emoji/mattermost.png');
        });

        test('return correct url for custom emojis', () => {
            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getCustomEmojiMock({id: 'custom_emoji', category: 'custom'}))).toBe('/api/v4/emoji/custom_emoji/image');

            expect(EmojiUtils.getEmojiImageUrl(TestHelper.getCustomEmojiMock({id: 'custom_emoji'}))).toBe('/api/v4/emoji/custom_emoji/image');
        });
    });
});
