// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomEmoji, Emoji} from '@mattermost/types/emojis';

import {autocompleteCustomEmojis} from 'mattermost-redux/actions/emojis';

import {getEmojiMap, getRecentEmojisNames} from 'selectors/emojis';
import store from 'stores/redux_store';

import EmojiMap from 'utils/emoji_map';

import EmoticonProvider, {
    MIN_EMOTICON_LENGTH,
    EMOJI_CATEGORY_SUGGESTION_BLOCKLIST,
    CUSTOM_EMOJI_AUTOCOMPLETE_LIMIT,
} from './emoticon_provider';

jest.mock('mattermost-redux/actions/emojis', () => ({
    autocompleteCustomEmojis: jest.fn((name: string) => ({type: 'MOCK_AUTOCOMPLETE', name})),
}));

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

    describe('with custom emoji enabled', () => {
        type Deferred = {resolve: (value: unknown) => void};
        let dispatches: Deferred[];

        beforeEach(() => {
            dispatches = [];
            mockedGetEmojiMap.mockReturnValue(emojiMap);
            mockedGetRecentEmojisNames.mockReturnValue([]);
            jest.spyOn(store, 'getState').mockReturnValue({
                entities: {
                    general: {config: {EnableCustomEmoji: 'true'}},
                    preferences: {myPreferences: {}},
                },
            } as unknown as ReturnType<typeof store.getState>);
            jest.spyOn(store, 'dispatch').mockImplementation((() => {
                return new Promise((resolve) => {
                    dispatches.push({resolve});
                });
            }) as unknown as typeof store.dispatch);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

        it('should suggest local emojis before the server responds', () => {
            const provider = new EmoticonProvider();

            provider.handlePretextChanged(':thu', resultsCallback);

            expect(resultsCallback).toHaveBeenCalledTimes(1);
            expect(autocompleteCustomEmojis).toHaveBeenCalledWith('thu');
        });

        it('should suggest again once the server responds', async () => {
            const provider = new EmoticonProvider();

            provider.handlePretextChanged(':thu', resultsCallback);
            dispatches[0].resolve({data: []});
            await flushPromises();

            expect(resultsCallback).toHaveBeenCalledTimes(2);
            expect(resultsCallback.mock.calls[1][0].matchedPretext).toBe(':thu');
        });

        it('should ignore a server response for a superseded prefix', async () => {
            const provider = new EmoticonProvider();

            provider.handlePretextChanged(':th', resultsCallback);
            provider.handlePretextChanged(':thu', resultsCallback);
            expect(resultsCallback).toHaveBeenCalledTimes(2);

            dispatches[0].resolve({data: []});
            await flushPromises();
            expect(resultsCallback).toHaveBeenCalledTimes(2);

            dispatches[1].resolve({data: []});
            await flushPromises();
            expect(resultsCallback).toHaveBeenCalledTimes(3);
            expect(resultsCallback.mock.calls[2][0].matchedPretext).toBe(':thu');
        });

        it('should not fetch again when extending a prefix the server fully answered', async () => {
            const provider = new EmoticonProvider();

            provider.handlePretextChanged(':th', resultsCallback);
            dispatches[0].resolve({data: []});
            await flushPromises();

            provider.handlePretextChanged(':thu', resultsCallback);
            expect(autocompleteCustomEmojis).toHaveBeenCalledTimes(1);

            provider.handlePretextChanged(':li', resultsCallback);
            expect(autocompleteCustomEmojis).toHaveBeenCalledTimes(2);
        });

        it('should fetch again when extending a prefix that hit the server limit', async () => {
            const provider = new EmoticonProvider();

            provider.handlePretextChanged(':th', resultsCallback);
            dispatches[0].resolve({data: new Array(CUSTOM_EMOJI_AUTOCOMPLETE_LIMIT).fill({})});
            await flushPromises();

            provider.handlePretextChanged(':thu', resultsCallback);
            expect(autocompleteCustomEmojis).toHaveBeenCalledTimes(2);
        });
    });
});
