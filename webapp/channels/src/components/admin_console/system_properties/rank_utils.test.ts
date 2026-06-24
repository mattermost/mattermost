// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    findRankCollision,
    isValidRank,
    moveOptionByAscIndex,
    nextRank,
    reassignRanksByOrder,
    sortOptionsByRankAsc,
    sortOptionsByRankDesc,
} from './rank_utils';

const opt = (id: string, name: string, rank: number): PropertyFieldOption => ({id, name, rank});

describe('rank_utils', () => {
    const options = [
        opt('a', 'Secret', 2),
        opt('b', 'Unclassified', 1),
        opt('c', 'TopSecret', 3),
    ];

    test('sortOptionsByRankAsc orders lowest rank first', () => {
        expect(sortOptionsByRankAsc(options).map((o) => o.name)).toEqual(['Unclassified', 'Secret', 'TopSecret']);
    });

    test('sortOptionsByRankDesc orders highest rank first', () => {
        expect(sortOptionsByRankDesc(options).map((o) => o.name)).toEqual(['TopSecret', 'Secret', 'Unclassified']);
    });

    test('does not mutate the input array', () => {
        const input = [...options];
        sortOptionsByRankAsc(input);
        sortOptionsByRankDesc(input);
        expect(input).toEqual(options);
    });

    describe('nextRank', () => {
        test('returns 1 for an empty schema', () => {
            expect(nextRank([])).toBe(1);
        });

        test('returns max rank + 1', () => {
            expect(nextRank(options)).toBe(4);
        });
    });

    describe('reassignRanksByOrder', () => {
        test('maps the sorted rank set onto the given ascending order', () => {
            const reordered = [opt('b', 'Unclassified', 1), opt('c', 'TopSecret', 3), opt('a', 'Secret', 2)];
            const result = reassignRanksByOrder(reordered);
            expect(result.map((o) => [o.name, o.rank])).toEqual([
                ['Unclassified', 1],
                ['TopSecret', 2],
                ['Secret', 3],
            ]);
        });

        test('preserves non-contiguous rank values', () => {
            const reordered = [opt('a', 'A', 10), opt('b', 'B', 1), opt('c', 'C', 5)];
            const result = reassignRanksByOrder(reordered);
            expect(result.map((o) => o.rank)).toEqual([1, 5, 10]);
        });
    });

    describe('moveOptionByAscIndex', () => {
        test('moving the lowest to the top reassigns ranks without duplicates', () => {
            // ascending: Unclassified(1), Secret(2), TopSecret(3)
            // move index 0 (Unclassified) to index 2 (top of ascending = highest rank)
            const result = moveOptionByAscIndex(options, 0, 2);
            const asc = sortOptionsByRankAsc(result);
            expect(asc.map((o) => o.name)).toEqual(['Secret', 'TopSecret', 'Unclassified']);
            expect(asc.map((o) => o.rank)).toEqual([1, 2, 3]);
            expect(new Set(asc.map((o) => o.rank)).size).toBe(3);
        });

        test('out-of-range index returns the options unchanged', () => {
            expect(moveOptionByAscIndex(options, 9, 0)).toBe(options);
        });
    });

    describe('isValidRank', () => {
        test.each([
            [1, true],
            [5, true],
            [0, false],
            [-1, false],
            [1.5, false],
            [undefined, false],
        ])('isValidRank(%p) === %p', (rank, expected) => {
            expect(isValidRank(rank as number | undefined)).toBe(expected);
        });
    });

    describe('findRankCollision', () => {
        test('finds another option already using the rank', () => {
            const dup = [opt('a', 'Secret', 2), opt('b', 'Other', 2)];
            expect(findRankCollision(dup, 2, 0)?.name).toBe('Other');
        });

        test('ignores the option at the exempt index', () => {
            // Secret holds rank 2 at index 0; exempting it leaves no other rank-2 option.
            expect(findRankCollision(options, 2, 0)).toBeUndefined();
        });

        test('returns undefined when the rank is free', () => {
            expect(findRankCollision(options, 99, -1)).toBeUndefined();
        });
    });
});
