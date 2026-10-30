// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {appendQuoteToMessage, formatQuote} from './quote';

describe('formatQuote', () => {
    test('should prefix a single line', () => {
        expect(formatQuote('Diam sapien pellentesque')).toBe('> Diam sapien pellentesque');
    });

    test('should prefix every line and keep blank lines inside the quote', () => {
        expect(formatQuote('first line\n\nsecond line\nthird line')).toBe('> first line\n>\n> second line\n> third line');
    });

    test('should keep every blank line so code blocks stay intact', () => {
        expect(formatQuote('```\nfirst\n\n\nsecond\n```')).toBe('> ```\n> first\n>\n>\n> second\n> ```');
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
