// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isSearchModifier, quoteSearchTerms} from 'utils/search';

describe('isSearchModifier', () => {
    test.each([
        ['in:town-square', true],
        ['In:town-square', true],
        ['-in:town-square', true],
        ['from:user-name', true],
        ['channel:town-square', true],
        ['before:2026-01-01', true],
        ['after:2026-01-01', true],
        ['on:2026-01-01', true],
        ['ext:txt', true],
        ['in:', true],
        ['@user-name', false],
        ['intro:something', false],
        ['in', false],
        ['http://example.com', false],
    ])('%s', (term, expected) => {
        expect(isSearchModifier(term)).toBe(expected);
    });
});

describe('quoteSearchTerms', () => {
    test('quotes each term', () => {
        expect(quoteSearchTerms('@user-name user.name')).toEqual('"@user-name" "user.name"');
    });

    test('collapses extra whitespace', () => {
        expect(quoteSearchTerms('  @user-name   ')).toEqual('"@user-name"');
    });

    test('leaves modifiers unquoted so that they keep filtering the search', () => {
        expect(quoteSearchTerms('@user-name in:town-square')).toEqual('"@user-name" in:town-square');
        expect(quoteSearchTerms('@user-name -in:town-square from:someone')).toEqual('"@user-name" -in:town-square from:someone');
    });

    test('leaves a modifier value written as a separate word unquoted', () => {
        expect(quoteSearchTerms('@user-name in: town-square')).toEqual('"@user-name" in: town-square');
    });

    test('quotes a term that only looks like a modifier', () => {
        expect(quoteSearchTerms('intro:something')).toEqual('"intro:something"');
    });

    test('returns an empty string for empty terms', () => {
        expect(quoteSearchTerms('   ')).toEqual('');
    });
});
