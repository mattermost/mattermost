// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomEmoji, Emoji, SystemEmoji} from '@mattermost/types/emojis';

import {getEmojiMap, getRecentEmojisNames} from 'selectors/emojis';

import EmojiMap from 'utils/emoji_map';
import {unifiedToUnicode} from 'utils/emoji_utils';

import EmoticonProvider, {
    MIN_EMOTICON_LENGTH,
    EMOJI_CATEGORY_SUGGESTION_BLOCKLIST,
} from './emoticon_provider';

jest.mock('selectors/emojis', () => ({
    getEmojiMap: jest.fn(),
    getRecentEmojisNames: jest.fn(),
}));

const mockedGetEmojiMap = jest.mocked(getEmojiMap);
const mockedGetRecentEmojisNames = jest.mocked(getRecentEmojisNames);

describe('components/EmoticonProvider', () => {
    const resultsCallback = jest.fn();
    const emoticonProvider = new EmoticonProvider();
    const customEmojis: Map<string, any> = new Map([
        [
            'thumbsdown-custom',
            {name: 'thumbsdown-custom', category: 'custom'},
        ],
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
        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue([]);

        for (const i of [MIN_EMOTICON_LENGTH, MIN_EMOTICON_LENGTH + 1]) {
            const pretext = `:${'s'.repeat(i)}`;

            emoticonProvider.handlePretextChanged(pretext, resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
        }
    });

    it('should order suggested emojis', () => {
        const pretext = ':thu';
        const recentEmojis = ['smile'];
        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.groups[0].items.filter(
            (item: Emoji) => item.name.indexOf('skin') === -1,
        );
        expect(results.map((item: Emoji) => item.name)).toEqual([
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

        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        expect(args.groups[0].items.length).toEqual(0);
    });

    it('should exclude blocklisted emojis from suggested emojis', () => {
        const pretext = ':blocklisted';
        const recentEmojis = ['blocklisted-1'];

        const blocklistedEmojis: Array<[string, any]> = EMOJI_CATEGORY_SUGGESTION_BLOCKLIST.map(
            (category, index) => {
                const name = `blocklisted-${index}`;
                return [name, {name, category}];
            },
        );
        const customEmojisWithBlocklist: Map<string, CustomEmoji> = new Map([
            ...blocklistedEmojis,
            [
                'not-blocklisted',
                {name: 'not-blocklisted', category: 'custom'},
            ],
        ]);
        const emojiMapWithBlocklist = new EmojiMap(customEmojisWithBlocklist);

        mockedGetEmojiMap.mockReturnValue(emojiMapWithBlocklist);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        expect(args.groups.length).toEqual(1);
        expect(args.groups[0].items.length).toEqual(1);
        expect(args.groups[0].items[0].name).toEqual('not-blocklisted');
    });

    it('should suggest emojis ordered by recently used first (system only)', () => {
        const pretext = ':thu';
        const emojis = ['thunder_cloud_and_rain', 'smile'];
        for (const thumbsup of ['+1', 'thumbsup']) {
            const recentEmojis = [...emojis, thumbsup];
            mockedGetEmojiMap.mockReturnValue(emojiMap);
            mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

            emoticonProvider.handlePretextChanged(pretext, resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
            const args = resultsCallback.mock.calls[0][0];
            const results = args.groups[0].items.filter(
                (item: Emoji) => item.name.indexOf('skin') === -1,
            );
            expect(results.map((item: Emoji) => item.name)).toEqual([
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
        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.groups[0].items.filter(
            (item: Emoji) => item.name.indexOf('skin') === -1,
        );
        expect(results.map((item: Emoji) => item.name)).toEqual([
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
        const recentEmojis = [
            'thumbsdown-custom',
            'lithuania-custom',
            'thumbsup',
            '-1',
            'smile',
        ];
        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.groups[0].items.filter(
            (item: Emoji) => item.name.indexOf('skin') === -1,
        );
        expect(results.map((item: Emoji) => item.name)).toEqual([
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
        const recentEmojis = [
            'lithuania-custom',
            'thumbsup-custom',
            '+1',
            'smile',
        ];
        mockedGetEmojiMap.mockReturnValue(emojiMap);
        mockedGetRecentEmojisNames.mockReturnValue(recentEmojis);

        emoticonProvider.handlePretextChanged(pretext, resultsCallback);
        expect(resultsCallback).toHaveBeenCalled();
        const args = resultsCallback.mock.calls[0][0];
        const results = args.groups[0].items.filter(
            (item: Emoji) => item.name.indexOf('skin') === -1,
        );
        expect(results.map((item: Emoji) => item.name)).toEqual([
            'thumbsup',
            'thumbsup-custom',
            'thumbsdown',
            'thumbsdown-custom',
        ]);
    });

    describe('formatEmojis', () => {
        const systemEmojiItem = {
            name: '+1',
            emoji: {
                name: 'thumbsup',
                short_name: '+1',
                short_names: ['+1', 'thumbsup'],
                unified: '1F44D',
                category: 'people-body',
            } as SystemEmoji,
        };
        const customEmojiItem = {
            name: 'thumbsup-custom',
            emoji: customEmojis.get('thumbsup-custom'),
        };

        it('returns unicode for system emojis in normal mode', () => {
            const terms = emoticonProvider.formatEmojis([systemEmojiItem]);
            expect(terms).toEqual([unifiedToUnicode('1F44D')]);
        });

        it('returns :name: format for system emojis in reaction mode', () => {
            const terms = emoticonProvider.formatEmojis([systemEmojiItem], true);
            expect(terms).toEqual([':+1:']);
        });

        it('returns :name: format for custom emojis regardless of reaction mode', () => {
            expect(emoticonProvider.formatEmojis([customEmojiItem])).toEqual([':thumbsup-custom:']);
            expect(emoticonProvider.formatEmojis([customEmojiItem], true)).toEqual([':thumbsup-custom:']);
        });
    });

    describe('reaction mode autocomplete', () => {
        it('should provide :name: terms when pretext uses + reaction prefix', () => {
            mockedGetEmojiMap.mockReturnValue(emojiMap);
            mockedGetRecentEmojisNames.mockReturnValue([]);

            emoticonProvider.handlePretextChanged('+:+1', resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
            const args = resultsCallback.mock.calls[0][0];
            const terms: string[] = args.groups[0].terms;
            expect(terms.every((t: string) => t.startsWith(':') && t.endsWith(':'))).toBe(true);
        });

        it('should provide :name: terms when pretext uses - reaction prefix', () => {
            mockedGetEmojiMap.mockReturnValue(emojiMap);
            mockedGetRecentEmojisNames.mockReturnValue([]);

            emoticonProvider.handlePretextChanged('-:+1', resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
            const args = resultsCallback.mock.calls[0][0];
            const terms: string[] = args.groups[0].terms;
            expect(terms.every((t: string) => t.startsWith(':') && t.endsWith(':'))).toBe(true);
        });

        it('should provide unicode terms when pretext does not use a reaction prefix', () => {
            mockedGetEmojiMap.mockReturnValue(emojiMap);
            mockedGetRecentEmojisNames.mockReturnValue([]);

            emoticonProvider.handlePretextChanged(':+1', resultsCallback);
            expect(resultsCallback).toHaveBeenCalled();
            const args = resultsCallback.mock.calls[0][0];
            const terms: string[] = args.groups[0].terms;
            // System emoji +1 should produce unicode, not :name:
            const plusOneTerm = terms.find((t: string) => !t.startsWith(':'));
            expect(plusOneTerm).toBeDefined();
        });
    });
});
