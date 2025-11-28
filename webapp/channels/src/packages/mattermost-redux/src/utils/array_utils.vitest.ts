// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {insertWithoutDuplicates, insertMultipleWithoutDuplicates, removeItem} from './array_utils';

describe('insertWithoutDuplicates', () => {
    test('should add the item at the given location', () => {
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'z', 0)).toEqual(['z', 'a', 'b', 'c', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'z', 1)).toEqual(['a', 'z', 'b', 'c', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'z', 2)).toEqual(['a', 'b', 'z', 'c', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'z', 3)).toEqual(['a', 'b', 'c', 'z', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'z', 4)).toEqual(['a', 'b', 'c', 'd', 'z']);
    });

    test('should move an item if it already exists', () => {
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'a', 0)).toEqual(['a', 'b', 'c', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'a', 1)).toEqual(['b', 'a', 'c', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(insertWithoutDuplicates(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['b', 'c', 'd', 'a']);
    });

    test('should return the original array if nothing changed', () => {
        const input = ['a', 'b', 'c', 'd'];

        expect(insertWithoutDuplicates(input, 'a', 0)).toBe(input);
    });
});

describe('insertMultipleWithoutDuplicates', () => {
    test('should add the item at the given location', () => {
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x'], 0)).toEqual(['z', 'y', 'x', 'a', 'b', 'c', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x'], 1)).toEqual(['a', 'z', 'y', 'x', 'b', 'c', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x'], 2)).toEqual(['a', 'b', 'z', 'y', 'x', 'c', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x'], 3)).toEqual(['a', 'b', 'c', 'z', 'y', 'x', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x'], 4)).toEqual(['a', 'b', 'c', 'd', 'z', 'y', 'x']);
    });

    test('should move an item if it already exists', () => {
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['a', 'c'], 0)).toEqual(['a', 'c', 'b', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['a', 'c'], 1)).toEqual(['b', 'a', 'c', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['a', 'c'], 2)).toEqual(['b', 'd', 'a', 'c']);
    });

    test('should properly place new and existing items', () => {
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x', 'a', 'c'], 0)).toEqual(['z', 'y', 'x', 'a', 'c', 'b', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x', 'a', 'c'], 1)).toEqual(['b', 'z', 'y', 'x', 'a', 'c', 'd']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['z', 'y', 'x', 'a', 'c'], 2)).toEqual(['b', 'd', 'z', 'y', 'x', 'a', 'c']);
    });

    test('should return the original array if nothing changed', () => {
        const input = ['a', 'b', 'c', 'd'];

        expect(insertMultipleWithoutDuplicates(input, ['a', 'b', 'c'], 0)).toStrictEqual(input);
    });

    test('should just return the array if either the input or items to insert is blank', () => {
        expect(insertMultipleWithoutDuplicates([], ['a', 'b', 'c'], 0)).toStrictEqual(['a', 'b', 'c']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c'], [], 0)).toStrictEqual(['a', 'b', 'c']);
    });

    test('should handle invalid index inputs', () => {
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['e', 'f'], 10)).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'f']);
        expect(insertMultipleWithoutDuplicates(['a', 'b', 'c', 'd'], ['e', 'f'], -2)).toStrictEqual(['a', 'b', 'e', 'f', 'c', 'd']);
    });
});

describe('removeItem', () => {
    test('should remove the given item', () => {
        expect(removeItem(['a', 'b', 'c', 'd'], 'a')).toEqual(['b', 'c', 'd']);
        expect(removeItem(['a', 'b', 'c', 'd'], 'b')).toEqual(['a', 'c', 'd']);
        expect(removeItem(['a', 'b', 'c', 'd'], 'c')).toEqual(['a', 'b', 'd']);
        expect(removeItem(['a', 'b', 'c', 'd'], 'd')).toEqual(['a', 'b', 'c']);
    });

    test('should return the original array if nothing changed', () => {
        const input = ['a', 'b', 'c', 'd'];

        expect(removeItem(input, 'e')).toBe(input);
    });
});
