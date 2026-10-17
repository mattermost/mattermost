// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {appendQuoteToMessage, formatQuote, getQuoteParagraphs} from './quote';

describe('getQuoteParagraphs', () => {
    test('should group lines into paragraphs separated by blank lines', () => {
        expect(getQuoteParagraphs('one\ntwo\n\nthree')).toEqual([['one', 'two'], ['three']]);
    });

    test('should return no paragraphs for blank text', () => {
        expect(getQuoteParagraphs('\n  \n')).toEqual([]);
    });
});

describe('formatQuote', () => {
    test('should prefix a single line', () => {
        expect(formatQuote('Diam sapien pellentesque')).toBe('> Diam sapien pellentesque');
    });

    test('should prefix every line and keep blank lines inside the quote', () => {
        expect(formatQuote('first line\n\nsecond line\nthird line')).toBe('> first line\n>\n> second line\n> third line');
    });

    test('should collapse several blank lines into a single quoted blank line', () => {
        expect(formatQuote('first\n\n \n\nsecond')).toBe('> first\n>\n> second');
    });

    test('should normalize Windows line endings', () => {
        expect(formatQuote('first\r\nsecond')).toBe('> first\n> second');
    });

    test('should drop leading and trailing blank lines and trailing whitespace', () => {
        expect(formatQuote('\n\n  indented line  \nlast   \n\n')).toBe('>   indented line\n> last');
    });

    test('should return an empty string for whitespace-only text', () => {
        expect(formatQuote(' \n\t\n ')).toBe('');
    });
});

describe('appendQuoteToMessage', () => {
    test('should insert the quote followed by an empty line into an empty draft', () => {
        expect(appendQuoteToMessage('', 'quoted')).toBe('> quoted\n\n');
    });

    test('should treat a whitespace-only draft as empty', () => {
        expect(appendQuoteToMessage('  \n', 'quoted')).toBe('> quoted\n\n');
    });

    test('should append the quote on its own line after the existing draft', () => {
        expect(appendQuoteToMessage('Hey there', 'quoted')).toBe('Hey there\n\n> quoted\n\n');
    });

    test('should keep a second quote separate from a previous one', () => {
        const once = appendQuoteToMessage('', 'first');
        expect(appendQuoteToMessage(once, 'second')).toBe('> first\n\n> second\n\n');
    });

    test('should leave the draft untouched when there is nothing to quote', () => {
        expect(appendQuoteToMessage('Hey there', '   ')).toBe('Hey there');
    });
});
