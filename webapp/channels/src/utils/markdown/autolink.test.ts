// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {matchGFMUrl, trimTrailingCharactersFromLink} from './autolink';

describe('trimTrailingCharactersFromLink', () => {
    test('trims trailing period', () => {
        expect(trimTrailingCharactersFromLink('http://example.com.')).toBe(
            'http://example.com',
        );
    });

    test('keeps balanced parentheses', () => {
        expect(
            trimTrailingCharactersFromLink(
                'https://en.wikipedia.org/wiki/Rendering_(computer_graphics)',
            ),
        ).toBe('https://en.wikipedia.org/wiki/Rendering_(computer_graphics)');
    });

    test('trims extra closing parenthesis', () => {
        expect(
            trimTrailingCharactersFromLink(
                'https://en.wikipedia.org/wiki/Dolphin_(disambiguation))',
            ),
        ).toBe('https://en.wikipedia.org/wiki/Dolphin_(disambiguation)');
    });

    test('keeps deeply nested parentheses', () => {
        expect(
            trimTrailingCharactersFromLink(
                'https://godbolt.org/#g:!((g:!((g:!((h:codeEditor))))',
            ),
        ).toBe('https://godbolt.org/#g:!((g:!((g:!((h:codeEditor))))');
    });

    test('keeps angle brackets inside URL', () => {
        expect(
            trimTrailingCharactersFromLink(
                'https://godbolt.org/#include+<meta>',
            ),
        ).toBe('https://godbolt.org/#include+<meta>');
    });

    test('trims trailing angle bracket', () => {
        expect(trimTrailingCharactersFromLink('http://www.example.com>')).toBe(
            'http://www.example.com',
        );
    });
});

describe('matchGFMUrl', () => {
    test('matches simple https URL', () => {
        expect(matchGFMUrl('https://example.com and text')?.[0]).toBe(
            'https://example.com',
        );
    });

    test('matches URL with hash fragment', () => {
        expect(
            matchGFMUrl('https://en.wikipedia.org/wiki/URLs#Syntax')?.[0],
        ).toBe('https://en.wikipedia.org/wiki/URLs#Syntax');
    });

    test('matches URL with deeply nested parentheses', () => {
        const url =
            "https://godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1'))";
        expect(matchGFMUrl(url)?.[0]).toBe(url);
    });

    test('matches URL with decoded angle brackets in fragment', () => {
        const url = "https://godbolt.org/#g:!((source:'#include+<meta>'))";
        expect(matchGFMUrl(url)?.[0]).toBe(url);
    });

    test('stops URL at newline', () => {
        expect(
            matchGFMUrl("https://example.com/foo\nmore text")?.[0],
        ).toBe('https://example.com/foo');
    });

    test('does not match plain domain without slash', () => {
        expect(matchGFMUrl('example.com')).toBeNull();
    });

    test('stops URL at blank line', () => {
        expect(
            matchGFMUrl('https://example.com/foo\n\nnext paragraph')?.[0],
        ).toBe('https://example.com/foo');
    });

    test('trims trailing punctuation from surrounding text', () => {
        expect(matchGFMUrl('https://example.com.')?.[0]).toBe(
            'https://example.com',
        );
    });

    test('stops at full-width punctuation', () => {
        expect(
            matchGFMUrl('https://mattermost.com/，這是第二個網址。')?.[0],
        ).toBe('https://mattermost.com/');
    });

    test('stops at closing HTML tag after URL', () => {
        expect(matchGFMUrl('www.example.com</b>text')?.[0]).toBe(
            'www.example.com',
        );
        expect(matchGFMUrl('https://example.com</b>text')?.[0]).toBe(
            'https://example.com',
        );
    });

    test('stops at opening HTML tag after host', () => {
        expect(matchGFMUrl('www.example.com<b>text')?.[0]).toBe(
            'www.example.com',
        );
        expect(matchGFMUrl('https://example.com<b>text')?.[0]).toBe(
            'https://example.com',
        );
    });

    test('stops at HTML tag after URL path', () => {
        expect(matchGFMUrl('www.example.com/path<b>bold</b>')?.[0]).toBe(
            'www.example.com/path',
        );
        expect(matchGFMUrl('https://example.com/foo/bar<b>text</b>')?.[0]).toBe(
            'https://example.com/foo/bar',
        );
    });

    test('stops at self-closing HTML tag after URL path', () => {
        expect(matchGFMUrl('www.example.com/path<br/>')?.[0]).toBe(
            'www.example.com/path',
        );
        expect(matchGFMUrl('www.example.com/path<br />')?.[0]).toBe(
            'www.example.com/path',
        );
        expect(matchGFMUrl('https://example.com/foo<img src="x"/>')?.[0]).toBe(
            'https://example.com/foo',
        );
    });

    test('stops at HTML tag with attributes after URL path', () => {
        expect(matchGFMUrl('www.example.com/path<b class="x">bold</b>')?.[0]).toBe(
            'www.example.com/path',
        );
    });

    test('stops at HTML tag when attributes start after a newline', () => {
        expect(matchGFMUrl('https://example.com/path<b\nclass="x">')?.[0]).toBe(
            'https://example.com/path',
        );
        expect(matchGFMUrl('https://example.com/path<b\rclass="x">')?.[0]).toBe(
            'https://example.com/path',
        );
    });

    test('keeps angle brackets in URL path with godbolt context', () => {
        expect(matchGFMUrl('https://godbolt.org/#include+<meta> rest')?.[0]).toBe(
            'https://godbolt.org/#include+<meta>',
        );
    });

    test('stops URL at indented line after newline', () => {
        expect(matchGFMUrl('https://example.com/foo\n\tindented')?.[0]).toBe(
            'https://example.com/foo',
        );
    });
});
