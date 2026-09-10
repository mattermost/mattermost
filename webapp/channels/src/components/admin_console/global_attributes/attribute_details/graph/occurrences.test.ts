// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {canvasOccurrenceKey, expandOccurrences, indexOptions} from 'components/property_fields/graph';
import type {GraphOccurrence} from 'components/property_fields/graph';

import {
    expandAncestorsForOption,
    flattenOccurrenceTree,
    isHiddenByCollapsedAncestor,
    occurrenceHasChildren,
    occurrencePath,
    pathStartsWith,
    remapOccurrenceKey,
    subtreeInsertAfterIndex,
} from './occurrences';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

function flattenCanvas(options: PropertyFieldOption[]): GraphOccurrence[] {
    return flattenOccurrenceTree(expandOccurrences(indexOptions(options), {keyOf: canvasOccurrenceKey}));
}

describe('flattenOccurrenceTree', () => {
    test('roots have parentKey null and depth 0', () => {
        const occurrences = flattenCanvas([opt('A'), opt('B')]);
        expect(occurrences).toHaveLength(2);
        expect(occurrences[0]).toMatchObject({
            option: expect.objectContaining({name: 'A'}),
            parentKey: null,
            depth: 0,
        });
        expect(occurrencePath(occurrences[0])).toEqual(['A']);
        expect(occurrences[1]).toMatchObject({
            option: expect.objectContaining({name: 'B'}),
            parentKey: null,
            depth: 0,
        });
        expect(occurrencePath(occurrences[1])).toEqual(['B']);
    });

    test('child has parent and depth 1', () => {
        const occurrences = flattenCanvas([opt('A'), opt('B', ['A'])]);
        expect(occurrences[1]).toMatchObject({
            option: expect.objectContaining({name: 'B'}),
            parentKey: 'A',
            depth: 1,
        });
        expect(occurrencePath(occurrences[1])).toEqual(['A', 'B']);
    });

    test('key equals path joined with NUL', () => {
        const occurrences = flattenCanvas([opt('A'), opt('B', ['A']), opt('C', ['B'])]);
        for (const occurrence of occurrences) {
            expect(occurrence.key).toBe(occurrencePath(occurrence).join('\0'));
        }
        expect(occurrences[2].key).toBe('A\0B\0C');
    });

    test('walks in DFS order', () => {
        const options = [
            opt('A'),
            opt('B', ['A']),
            opt('C', ['A']),
            opt('D'),
        ];
        expect(flattenCanvas(options).map((row) => row.option.name)).toEqual(['A', 'B', 'C', 'D']);
    });

    test('skips a child already on the path (cycle guard)', () => {
        const cyclic = [
            opt('A'),
            opt('B', ['A', 'C']),
            opt('C', ['B']),
        ];
        const names = flattenCanvas(cyclic).map((row) => `${row.option.name}:${occurrencePath(row).join('>')}`);
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
    test('true when a child is seated', () => {
        const options = [opt('A'), opt('B', ['A'])];
        const [root] = flattenCanvas(options);
        expect(occurrenceHasChildren(root)).toBe(true);
    });

    test('false when every child is already on the path', () => {
        const options = [
            opt('A'),
            opt('B', ['A', 'C']),
            opt('C', ['B']),
        ];
        const leaf = flattenCanvas(options).find((row) => row.option.name === 'C');
        expect(leaf).toBeDefined();
        expect(occurrenceHasChildren(leaf!)).toBe(false);
    });
});

describe('expandAncestorsForOption', () => {
    const options = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
    const occurrences = flattenCanvas(options);

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
    const occurrences = flattenCanvas([
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
        expect(pathStartsWith(occurrencePath(occurrences[3]), occurrencePath(occurrences[0]))).toBe(false);
    });
});
