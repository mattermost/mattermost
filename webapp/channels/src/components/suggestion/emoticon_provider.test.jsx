// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getEmojiMap, getRecentEmojisNames} from 'selectors/emojis';

import EmojiMap from 'utils/emoji_map';

import EmoticonProvider, {
    MIN_EMOTICON_LENGTH,
    EMOJI_CATEGORY_SUGGESTION_BLOCKLIST,
} from './emoticon_provider';

jest.mock('selectors/emojis', () => ({
    getEmojiMap: jest.fn(),
    getRecentEmojisNames: jest.fn(),
}));

describe('components/EmoticonProvider', () => {
    const resultsCallback = jest.fn();
    const emoticonProvider = new EmoticonProvider();
    const customEmojis = new Map([
        ['thumbsdown-custom', {name: 'thumbsdown-custom', category: 'custom'}],
        ['thumbsup-custom', {name: 'thumbsup-custom', category: 'custom'}],
        ['lithuania-custom', {name: 'lithuania-custom', category: 'custom'}],
    ]);
    const emojiMap = new EmojiMap(customEmojis);

    it('should not suggest emojis when partial name < MIN_EMOTICON_LENGTH', () => {
        for (let i = 0; i < MIN_EMOTICON_LENGTH; i++) {
            const pretext = `:${'s'.repeat(i)}`;
            emoticonProvider.handlePretextChanged(pretext, resultsCallback);
            expect(resultsCallback).not.toHaveBeenCalled();
        }
    });

    it('should suggest emojis when partial name >= MIN_EMOTICON_LENGTH', () => {
        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue([]);

        for (const i of [MIN_EMOTICON_LENGTH, MIN_EMOTICON_LENGTH + 1]) {
            const pretext = `:${'s'.repeat(i)}`;

            emoticonProvider.handlePretextChanged(pretext, resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
        }
    });

    it('should order suggested emojis', () => {
        const pretext = ':thu';
        const recentEmojis = ['smile'];
        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.items.filter((item) => item.name.indexOf('skin') === -1);
        expect(results.map((item) => item.name)).toEqual([
            'thumbsup', // thumbsup is a special case where it always appears before thumbsdown
            'thumbsdown',
            'thunder_cloud_and_rain',
            'thumbsdown-custom',
            'thumbsup-custom',
            'lithuania',
            'lithuania-custom',
        ]);
    });

    it('should not suggest emojis if no match', () => {
        const pretext = ':supercalifragilisticexpialidocious';
        const recentEmojis = ['smile'];

        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        expect(args.items.length).toEqual(0);
    });

    it('should exclude blocklisted emojis from suggested emojis', () => {
        const pretext = ':blocklisted';
        const recentEmojis = ['blocklisted-1'];

        const blocklistedEmojis = EMOJI_CATEGORY_SUGGESTION_BLOCKLIST.map((category, index) => {
            const name = `blocklisted-${index}`;
            return [name, {name, category}];
        });
        const customEmojisWithBlocklist = new Map([
            ...blocklistedEmojis,
            ['not-blocklisted', {name: 'not-blocklisted', category: 'custom'}],
        ]);
        const emojiMapWithBlocklist = new EmojiMap(customEmojisWithBlocklist);

        getEmojiMap.mockReturnValue(emojiMapWithBlocklist);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        expect(args.items.length).toEqual(1);
        expect(args.items[0].name).toEqual('not-blocklisted');
    });

    it('should suggest emojis ordered by recently used first (system only)', () => {
        const pretext = ':thu';
        const emojis = ['thunder_cloud_and_rain', 'smile'];
        for (const thumbsup of ['+1', 'thumbsup']) {
            const recentEmojis = [...emojis, thumbsup];
            getEmojiMap.mockReturnValue(emojiMap);
            getRecentEmojisNames.mockReturnValue(recentEmojis);

            emoticonProvider.handlePretextChanged(pretext, resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
            const args = resultsCallback.mock.calls[0][0];
            const results = args.items.filter((item) => item.name.indexOf('skin') === -1);
            expect(results.map((item) => item.name)).toEqual([
                'thumbsup',
                'thunder_cloud_and_rain',
                'thumbsdown',
                'thumbsdown-custom',
                'thumbsup-custom',
                'lithuania',
                'lithuania-custom',
            ]);
        }
    });

    it('should suggest emojis ordered by recently used first (custom only)', () => {
        const pretext = ':thu';
        const recentEmojis = ['lithuania-custom', 'thumbsdown-custom', 'smile'];
        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.items.filter((item) => item.name.indexOf('skin') === -1);
        expect(results.map((item) => item.name)).toEqual([
            'thumbsdown-custom',
            'lithuania-custom',
            'thumbsup',
            'thumbsdown',
            'thunder_cloud_and_rain',
            'thumbsup-custom',
            'lithuania',
        ]);
    });

    it('should suggest emojis ordered by recently used first (custom and system)', () => {
        const pretext = ':thu';
        const recentEmojis = ['thumbsdown-custom', 'lithuania-custom', 'thumbsup', '-1', 'smile'];
        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.items.filter((item) => item.name.indexOf('skin') === -1);
        expect(results.map((item) => item.name)).toEqual([
            'thumbsup',
            'thumbsdown',
            'thumbsdown-custom',
            'lithuania-custom',
            'thunder_cloud_and_rain',
            'thumbsup-custom',
            'lithuania',
        ]);
    });

    it('should suggest emojis ordered by recently used first with partial name match', () => {
        const pretext = ':umbs';
        const recentEmojis = ['lithuania-custom', 'thumbsup-custom', '+1', 'smile'];
        getEmojiMap.mockReturnValue(emojiMap);
        getRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.items.filter((item) => item.name.indexOf('skin') === -1);
        expect(results.map((item) => item.name)).toEqual([
            'thumbsup',
            'thumbsup-custom',
            'thumbsdown',
            'thumbsdown-custom',
        ]);
    });
});
