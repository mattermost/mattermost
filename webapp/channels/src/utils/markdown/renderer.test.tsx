// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Renderer from './renderer';

describe('link / mm_action markdown (MM blocks)', () => {
    test('renders mm_action href as data-mm-action anchor when enabled', () => {
        const renderer = new Renderer({}, {enableMmActionMarkdownLinks: true});
        const out = renderer.link('mmaction:approve?reason=ok', '', 'Approve');
        expect(out).toContain('data-mm-action-id="approve"');
        expect(out).toContain('mm-action-md-link');
        expect(decodeURIComponent(
            (out.match(/data-mm-action-query="([^"]+)"/) || [])[1] || '',
        )).toEqual(JSON.stringify({reason: 'ok'}));
    });

    test('treats mm_action as normal link when flag is off', () => {
        const renderer = new Renderer({}, {enableMmActionMarkdownLinks: false, siteURL: 'http://localhost:8065'});
        const out = renderer.link('mmaction:approve', '', 'x');
        expect(out).not.toContain('data-mm-action-id');
    });
});

describe('code', () => {
    test('too many tokens result in no search rendering', () => {
        const renderer = new Renderer({}, {searchPatterns: [{pattern: new RegExp('\\b()(foo)\\b', 'gi'), term: 'foo'}]});
        let originalString = 'foo '.repeat(501);
        let result = renderer.code(originalString, '');

        expect(result.includes('post-code__search-highlighting')).toBeTruthy();

        originalString = originalString.repeat(2);
        result = renderer.code(originalString, '');

        expect(result.includes('post-code__search-highlighting')).toBeFalsy();
    });
});

describe('codespan', () => {
    test('too many tokens result in no search rendering', () => {
        const renderer = new Renderer({}, {searchPatterns: [{pattern: new RegExp('\\b()(foo)\\b', 'gi'), term: 'foo'}]});
        let originalString = 'foo '.repeat(501);
        let result = renderer.codespan(originalString);

        expect(result.includes('search-highlight')).toBeTruthy();

        originalString = originalString.repeat(2);
        result = renderer.codespan(originalString);

        expect(result.includes('search-highlight')).toBeFalsy();
    });
});
