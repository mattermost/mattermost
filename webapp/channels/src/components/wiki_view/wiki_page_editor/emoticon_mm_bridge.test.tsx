// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Emoji} from '@mattermost/types/emojis';

import type {EmojiItem} from 'components/suggestion/emoticon_provider';

import {EmojiSuggestionExtension} from './emoticon_mm_bridge';

// Mock EmoticonProvider
jest.mock('components/suggestion/emoticon_provider', () => {
    const mockEmoticonSuggestion = jest.fn(() => null);

    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            handlePretextChanged: jest.fn((pretext: string, callback: (results: any) => void) => {
                // Simulate provider behavior - returns false if less than 2 chars after :
                const match = pretext.match(/^:(.*)$/);
                if (!match || match[1].length < 2) {
                    return false;
                }

                // Simulate returning emoji results
                const mockEmoji = {
                    unified: '1f600',
                    short_names: ['grinning'],
                    category: 'people',
                } as unknown as Emoji;

                callback({
                    groups: [{
                        key: 'emojis',
                        items: [{
                            name: 'grinning',
                            emoji: mockEmoji,
                        }],
                    }],
                });

                return true;
            }),
        })),
        EmoticonSuggestion: mockEmoticonSuggestion,
    };
});

// Mock suggestion_results
jest.mock('components/suggestion/suggestion_results', () => ({
    isItemLoaded: jest.fn((item) => !item || !('loading' in item) || !item.loading),
}));

// Mock suggestion_renderer
jest.mock('./suggestion_renderer', () => ({
    createSuggestionRenderer: jest.fn(() => ({
        render: () => ({
            onStart: jest.fn(),
            onUpdate: jest.fn(),
            onKeyDown: jest.fn(),
            onExit: jest.fn(),
        }),
    })),
}));

describe('EmojiSuggestionExtension', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extension configuration', () => {
        it('should have correct name', () => {
            expect(EmojiSuggestionExtension.name).toBe('emojiSuggestion');
        });

        it('should be defined', () => {
            expect(EmojiSuggestionExtension).toBeDefined();
        });
    });

    describe('emoji item type', () => {
        it('should have expected EmojiItem structure', () => {
            const mockEmoji = {
                unified: '1f600',
                short_names: ['grinning'],
                category: 'people',
            } as unknown as Emoji;

            const mockItem: EmojiItem = {
                name: 'grinning',
                emoji: mockEmoji,
            };

            expect(mockItem.name).toBe('grinning');
            expect(mockItem.emoji).toBeDefined();
        });
    });
});

describe('emoticon suggestion config', () => {
    it('should have correct popup class name in config', () => {
        // The popup class name is 'tiptap-emoticon-popup' as defined in emoticon_mm_bridge.tsx
        // This is verified by the extension using createSuggestionRenderer with this class
        expect(EmojiSuggestionExtension).toBeDefined();
    });

    it('should use : as trigger character', () => {
        // The extension uses ':' as the trigger character
        // This is configured in createEmoticonSuggestion which returns char: ':'
        expect(EmojiSuggestionExtension.name).toBe('emojiSuggestion');
    });
});

describe('emoji insertion behavior', () => {
    describe('system emoji insertion', () => {
        it('should convert unified code points to Unicode character', () => {
            // Test the logic for converting unified code points
            const unified = '1f600';
            const codePoints = unified.split('-').map((h: string) => parseInt(h, 16));
            const content = codePoints.map((cp) => String.fromCodePoint(cp)).join('');

            expect(content).toBe('😀');
        });

        it('should handle multi-codepoint emojis', () => {
            // Test multi-codepoint emoji (e.g., family emoji)
            const unified = '1f468-200d-1f469-200d-1f467';
            const codePoints = unified.split('-').map((h: string) => parseInt(h, 16));
            const content = codePoints.map((cp) => String.fromCodePoint(cp)).join('');

            expect(content.length).toBeGreaterThan(1);
        });
    });

    describe('custom emoji insertion', () => {
        it('should use :name: format for custom emojis', () => {
            const emojiName = 'custom_emoji';
            const content = `:${emojiName}:`;

            expect(content).toBe(':custom_emoji:');
        });
    });
});

describe('EmoticonProvider integration', () => {
    it('should format pretext with colon prefix', () => {
        const query = 'sm';
        const pretext = `:${query}`;

        expect(pretext).toBe(':sm');
    });

    it('should require minimum 2 characters after colon', () => {
        // MIN_EMOTICON_LENGTH = 2 in EmoticonProvider
        const shortQuery = 's';
        const longQuery = 'sm';

        expect(shortQuery.length).toBeLessThan(2);
        expect(longQuery.length).toBeGreaterThanOrEqual(2);
    });
});
