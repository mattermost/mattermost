// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {toValueList} from './multi_value_utils';

describe('toValueList', () => {
    it.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty string', ''],
    ])('treats %s as no entries', (_label, raw) => {
        expect(toValueList(raw)).toEqual([]);
    });

    it('passes an array through', () => {
        expect(toValueList(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('keeps an empty array empty', () => {
        expect(toValueList([])).toEqual([]);
    });

    it('wraps a bare scalar as a single entry', () => {
        expect(toValueList('SECRET')).toEqual(['SECRET']);
        expect(toValueList(0)).toEqual([0]);
        expect(toValueList(false)).toEqual([false]);
    });

    it('drops empty entries inside an array', () => {
        expect(toValueList(['a', '', null, 'b', undefined])).toEqual(['a', 'b']);
        expect(toValueList(['', null, undefined])).toEqual([]);
    });

    it('keeps falsy entries that are not empty', () => {
        expect(toValueList([0, false, 'a'])).toEqual([0, false, 'a']);
    });

    it('caps the list at maxItems', () => {
        expect(toValueList(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    });

    // Filtered first, so an empty entry cannot spend one of the slots.
    it('applies maxItems after dropping empty entries', () => {
        expect(toValueList(['a', '', null, 'b', 'c'], 2)).toEqual(['a', 'b']);
    });

    it('returns everything when maxItems is undefined', () => {
        expect(toValueList(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('treats a negative maxItems as zero rather than slicing from the end', () => {
        expect(toValueList(['a', 'b', 'c'], -1)).toEqual([]);
    });

    it('returns nothing for a maxItems of zero', () => {
        expect(toValueList(['a', 'b', 'c'], 0)).toEqual([]);
    });
});
