// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {stripBlockquotes} from 'utils/dm_preview_utils';

describe('dm_preview_utils', () => {
    describe('stripBlockquotes', () => {
        it('removes single blockquote line', () => {
            expect(stripBlockquotes('> quoted text')).toBe('');
        });

        it('removes blockquote lines and keeps non-blockquote text', () => {
            const input = '> quoted line\nregular text';
            expect(stripBlockquotes(input)).toBe('regular text');
        });

        it('handles multiple blockquote lines mixed with regular text', () => {
            const input = [
                '>[@revlis](https://example.com): quoted reply',
                '',
                'reply test :face_with_cowboy_hat:',
                '',
                '> blockquote',
            ].join('\n');
            expect(stripBlockquotes(input)).toBe('reply test :face_with_cowboy_hat:');
        });

        it('handles blockquotes with leading whitespace', () => {
            const input = '  > indented blockquote\nregular text';
            expect(stripBlockquotes(input)).toBe('regular text');
        });

        it('returns original text when no blockquotes present', () => {
            expect(stripBlockquotes('just regular text')).toBe('just regular text');
        });

        it('returns empty string when message is only blockquotes', () => {
            const input = '> line 1\n> line 2\n> line 3';
            expect(stripBlockquotes(input)).toBe('');
        });

        it('collapses multiple non-blockquote lines into single line', () => {
            const input = 'line one\nline two\nline three';
            expect(stripBlockquotes(input)).toBe('line one line two line three');
        });

        it('handles empty string', () => {
            expect(stripBlockquotes('')).toBe('');
        });

        it('trims whitespace from result', () => {
            const input = '> quote\n  hello  \n> another quote';
            expect(stripBlockquotes(input)).toBe('hello');
        });

        it('filters out empty lines left after removing blockquotes', () => {
            const input = '> quote\n\n\nhello\n\n> quote2';
            expect(stripBlockquotes(input)).toBe('hello');
        });
    });
});
