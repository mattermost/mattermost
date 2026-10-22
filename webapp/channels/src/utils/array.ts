// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Splits an array into two at the given index.
 * Returns a tuple of [before, after].
 */
export function partitionAt<T>(arr: readonly T[], index: number): [T[], T[]] {
    return [arr.slice(0, index), arr.slice(index)];
}
