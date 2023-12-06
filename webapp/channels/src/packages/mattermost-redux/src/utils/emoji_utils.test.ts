// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as EmojiUtils from 'mattermost-redux/utils/emoji_utils';

import TestHelper from '../../test/test_helper';

describe('EmojiUtils', () => {
    describe('parseEmojiNamesFromText', () => {
        test('should return empty array for text without emojis', () => {
            const actual = EmojiUtils.parseEmojiNamesFromText(
                'This has no emojis',
            );
            const expected: string[] = [];

            expect(actual).toEqual(expected);
        });

        test('should return anything that looks like an emoji', () => {
            const actual = EmojiUtils.parseEmojiNamesFromText(
                ':this: :is_all: :emo-jis: :123:',
            );
            const expected = ['this', 'is_all', 'emo-jis', '123'];

            expect(actual).toEqual(expected);
        });

        test('should correctly handle text surrounding emojis', () => {
            const actual = EmojiUtils.parseEmojiNamesFromText(
                ':this:/:is_all: (:emo-jis:) surrounding:123:text:456:asdf',
            );
            const expected = ['this', 'is_all', 'emo-jis', '123', '456'];

            expect(actual).toEqual(expected);
        });

        test('should not return duplicates', () => {
            const actual = EmojiUtils.parseEmojiNamesFromText(
                ':emoji: :emoji: :emoji: :emoji:',
            );
            const expected = ['emoji'];

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
