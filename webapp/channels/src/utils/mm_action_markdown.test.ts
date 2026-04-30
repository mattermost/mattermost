// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseMmActionMarkdownHref} from './mm_action_markdown';

describe('parseMmActionMarkdownHref', () => {
    test('parses action id without query', () => {
        expect(parseMmActionMarkdownHref('mmaction:approve')).toEqual({
            actionId: 'approve',
            query: {},
        });
        expect(parseMmActionMarkdownHref('mmaction://submit')).toEqual({
            actionId: 'submit',
            query: {},
        });
    });

    test('parses query string into a record', () => {
        expect(parseMmActionMarkdownHref('mmaction:go?foo=bar&baz=1')).toEqual({
            actionId: 'go',
            query: {foo: 'bar', baz: '1'},
        });
    });

    test('decodes path segment', () => {
        expect(parseMmActionMarkdownHref('mmaction:my%2Fact')).toEqual({
            actionId: 'my/act',
            query: {},
        });
    });

    test('returns null for non mm_action URLs', () => {
        expect(parseMmActionMarkdownHref('https://example.com')).toBeNull();
        expect(parseMmActionMarkdownHref('mmaction:')).toBeNull();
    });
});
