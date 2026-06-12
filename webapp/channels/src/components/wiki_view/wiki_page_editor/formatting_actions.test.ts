// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FORMATTING_ACTIONS, filterFormattingActions, getFormattingActionById} from './formatting_actions';

describe('FORMATTING_ACTIONS', () => {
    describe('emoji action', () => {
        it('includes emoji action with correct properties', () => {
            const emojiAction = FORMATTING_ACTIONS.find((a) => a.id === 'emoji');

            expect(emojiAction).toBeDefined();
            expect(emojiAction?.title).toBe('Emoji');
            expect(emojiAction?.description).toBe('Insert an emoji');
            expect(emojiAction?.requiresModal).toBe(true);
            expect(emojiAction?.modalType).toBe('emoji');
            expect(emojiAction?.category).toBe('media');
        });

        it('has correct aliases for emoji search', () => {
            const emojiAction = FORMATTING_ACTIONS.find((a) => a.id === 'emoji');

            expect(emojiAction?.aliases).toContain('emoticon');
            expect(emojiAction?.aliases).toContain('smiley');
            expect(emojiAction?.aliases).toContain('face');
            expect(emojiAction?.aliases).toContain('reaction');
        });
    });

    describe('filterFormattingActions', () => {
        it('returns emoji action when searching for "emoji"', () => {
            const results = filterFormattingActions('emoji');

            expect(results.some((a) => a.id === 'emoji')).toBe(true);
        });

        it('returns emoji action when searching for alias "smiley"', () => {
            const results = filterFormattingActions('smiley');

            expect(results.some((a) => a.id === 'emoji')).toBe(true);
        });

        it('returns emoji action when searching for alias "emoticon"', () => {
            const results = filterFormattingActions('emoticon');

            expect(results.some((a) => a.id === 'emoji')).toBe(true);
        });
    });

    describe('getFormattingActionById', () => {
        it('returns emoji action by id', () => {
            const action = getFormattingActionById('emoji');

            expect(action).toBeDefined();
            expect(action?.id).toBe('emoji');
            expect(action?.modalType).toBe('emoji');
        });
    });
});

describe('emoji conversion', () => {
    it('converts system emoji unified code to Unicode', () => {
        const unified = '1F600';
        const result = unified.
            split('-').
            map((code) => String.fromCodePoint(parseInt(code, 16))).
            join('');

        expect(result).toBe('😀');
    });

    it('converts compound emoji (ZWJ sequences) correctly', () => {
        // Woman technologist emoji: 👩‍💻
        const unified = '1F469-200D-1F4BB';
        const result = unified.
            split('-').
            map((code) => String.fromCodePoint(parseInt(code, 16))).
            join('');

        expect(result).toBe('👩‍💻');
    });

    it('converts skin tone modifier emojis correctly', () => {
        // Waving hand with medium-light skin tone: 👋🏼
        const unified = '1F44B-1F3FC';
        const result = unified.
            split('-').
            map((code) => String.fromCodePoint(parseInt(code, 16))).
            join('');

        expect(result).toBe('👋🏼');
    });

    it('converts flag emojis correctly', () => {
        // US flag: 🇺🇸
        const unified = '1F1FA-1F1F8';
        const result = unified.
            split('-').
            map((code) => String.fromCodePoint(parseInt(code, 16))).
            join('');

        expect(result).toBe('🇺🇸');
    });

    it('converts simple emoji correctly', () => {
        // Heart: ❤️
        const unified = '2764-FE0F';
        const result = unified.
            split('-').
            map((code) => String.fromCodePoint(parseInt(code, 16))).
            join('');

        expect(result).toBe('❤️');
    });
});
