// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    expandAncestorsForOption,
    flattenOccurrences,
    isHiddenByCollapsedAncestor,
    occurrenceHasChildren,
    pathStartsWith,
    remapOccurrenceKey,
    subtreeInsertAfterIndex,
} from './occurrences';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

describe('flattenOccurrences', () => {
    test('roots have parentName null and depth 0', () => {
        const occurrences = flattenOccurrences([opt('A'), opt('B')]);
        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toMatchObject({
            option: expect.objectContaining({name: 'A'}),
            parentName: null,
            depth: 0,
            path: ['A'],
        });
        expect(occurrences[1]).toMatchObject({
            option: expect.objectContaining({name: 'B'}),
            parentName: null,
            depth: 0,
            path: ['B'],
        });
    });

    test('child has parentName and depth 1', () => {
        const occurrences = flattenOccurrences([opt('A'), opt('B', ['A'])]);
        expect(occurrences[1]).toMatchObject({
            option: expect.objectContaining({name: 'B'}),
            parentName: 'A',
            depth: 1,
            path: ['A', 'B'],
        });
    });

    test('occurrenceKey equals path joined with NUL', () => {
        const occurrences = flattenOccurrences([opt('A'), opt('B', ['A']), opt('C', ['B'])]);
        for (const occurrence of occurrences) {
            expect(occurrence.occurrenceKey).toBe(occurrence.path.join('\0'));
        }
        expect(occurrences[2].occurrenceKey).toBe('A\0B\0C');
    });

    test('walks in DFS order', () => {
        const options = [
            opt('A'),
            opt('B', ['A']),
            opt('C', ['A']),
            opt('D'),
        ];
        expect(flattenOccurrences(options).map((row) => row.option.name)).toEqual(['A', 'B', 'C', 'D']);
    });

    test('skips a child already on the path (cycle guard)', () => {
        const cyclic = [
            opt('A'),
            opt('B', ['A', 'C']),
            opt('C', ['B']),
        ];
        const names = flattenOccurrences(cyclic).map((row) => `${row.option.name}:${row.path.join('>')}`);
        expect(names).toEqual(['A:A', 'B:A>B', 'C:A>B>C']);
    });
});

describe('pathStartsWith', () => {
    test('true for equal paths', () => {
        expect(pathStartsWith(['A', 'B'], ['A', 'B'])).toBe(true);
    });

    test('true when path is longer and shares the prefix', () => {
        expect(pathStartsWith(['A', 'B', 'C'], ['A', 'B'])).toBe(true);
    });

    test('false when path is shorter than the prefix', () => {
        expect(pathStartsWith(['A'], ['A', 'B'])).toBe(false);
    });

    test('false when a segment mismatches', () => {
        expect(pathStartsWith(['A', 'C'], ['A', 'B'])).toBe(false);
    });
});

describe('isHiddenByCollapsedAncestor', () => {
    test('hides when an ancestor key is collapsed', () => {
        expect(isHiddenByCollapsedAncestor(['A', 'B', 'C'], new Set(['A']))).toBe(true);
        expect(isHiddenByCollapsedAncestor(['A', 'B', 'C'], new Set(['A\0B']))).toBe(true);
    });

    test('does not hide when only a different branch is collapsed', () => {
        expect(isHiddenByCollapsedAncestor(['A', 'C'], new Set(['A\0B']))).toBe(false);
        expect(isHiddenByCollapsedAncestor(['D', 'E'], new Set(['A']))).toBe(false);
    });

    test('roots are never hidden by the collapsed set', () => {
        expect(isHiddenByCollapsedAncestor(['A'], new Set(['A']))).toBe(false);
    });
});

describe('occurrenceHasChildren', () => {
    test('true when a child name is not already on the path', () => {
        const options = [opt('A'), opt('B', ['A'])];
        const [root] = flattenOccurrences(options);
        expect(occurrenceHasChildren(options, root)).toBe(true);
    });

    test('false when every child is already on the path', () => {
        const options = [
            opt('A'),
            opt('B', ['A', 'C']),
            opt('C', ['B']),
        ];
        const leaf = flattenOccurrences(options).find((row) => row.option.name === 'C');
        expect(leaf).toBeDefined();
        expect(occurrenceHasChildren(options, leaf!)).toBe(false);
    });
});

describe('expandAncestorsForOption', () => {
    const options = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
    const occurrences = flattenOccurrences(options);

    test('deletes ancestor keys for a nested name', () => {
        const collapsed = new Set(['A', 'A\0B']);
        const next = expandAncestorsForOption(collapsed, occurrences, 'C');
        expect(next).not.toBe(collapsed);
        expect([...next]).toEqual([]);
    });

    test('is a no-op for a root', () => {
        const collapsed = new Set(['A']);
        expect(expandAncestorsForOption(collapsed, occurrences, 'A')).toBe(collapsed);
    });

    test('is a no-op for a missing name', () => {
        const collapsed = new Set(['A']);
        expect(expandAncestorsForOption(collapsed, occurrences, 'Z')).toBe(collapsed);
    });

    test('returns the same Set reference when unchanged', () => {
        const collapsed = new Set(['A']);
        expect(expandAncestorsForOption(collapsed, occurrences, 'A')).toBe(collapsed);
        expect(expandAncestorsForOption(collapsed, occurrences, 'Missing')).toBe(collapsed);
    });
});

describe('remapOccurrenceKey', () => {
    test('renames matching path segments only', () => {
        expect(remapOccurrenceKey('A\0B\0C', 'B', 'X')).toBe('A\0X\0C');
        expect(remapOccurrenceKey('A\0B\0A', 'A', 'X')).toBe('X\0B\0X');
        expect(remapOccurrenceKey('A\0B', 'C', 'X')).toBe('A\0B');
    });
});

describe('subtreeInsertAfterIndex', () => {
    const occurrences = flattenOccurrences([
        opt('A'),
        opt('B', ['A']),
        opt('C', ['A']),
        opt('D'),
    ]);

    test('insert-after is the last descendant of that occurrence', () => {
        expect(subtreeInsertAfterIndex(occurrences, occurrences[0], 0)).toBe(2);
        expect(subtreeInsertAfterIndex(occurrences, occurrences[1], 1)).toBe(1);
        expect(subtreeInsertAfterIndex(occurrences, occurrences[3], 3)).toBe(3);
    });

    test('stops at the first later non-descendant', () => {
        expect(subtreeInsertAfterIndex(occurrences, occurrences[0], 0)).toBe(2);
        expect(occurrences[3].option.name).toBe('D');
        expect(pathStartsWith(occurrences[3].path, occurrences[0].path)).toBe(false);
    });
});
