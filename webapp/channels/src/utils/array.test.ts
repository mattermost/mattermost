// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {partitionAt} from './array';

describe('partitionAt', () => {
    it('splits at the given index', () => {
        expect(partitionAt(['a', 'b', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']]);
    });

    it('returns everything in first half when index equals length', () => {
        expect(partitionAt([1, 2, 3], 3)).toEqual([[1, 2, 3], []]);
    });

    it('returns everything in second half when index is 0', () => {
        expect(partitionAt([1, 2, 3], 0)).toEqual([[], [1, 2, 3]]);
    });

    it('handles empty array', () => {
        expect(partitionAt([], 0)).toEqual([[], []]);
    });
});
