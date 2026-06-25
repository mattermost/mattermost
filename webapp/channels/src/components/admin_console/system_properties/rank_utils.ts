// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

// Helpers for working with ranked property-field options. A ranked field stores
// the usual select options plus a unique integer `rank` per option.
// Convention: higher integer = higher rank.

export const sortOptionsByRankAsc = (options: PropertyFieldOption[]): PropertyFieldOption[] =>
    [...options].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

export const sortOptionsByRankDesc = (options: PropertyFieldOption[]): PropertyFieldOption[] =>
    [...options].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

// The rank to auto-assign when adding an option: one more than the current max,
// or 1 for an empty schema (ranks are integers ≥ 1).
export const nextRank = (options: PropertyFieldOption[]): number => {
    if (!options.length) {
        return 1;
    }
    return Math.max(...options.map((o) => o.rank ?? 0)) + 1;
};

// Reassigns rank values to match a new visual order given in ascending order.
// Preserves the existing set of unique rank integers, mapping the smallest to
// the first ascending slot, so a reorder never produces a transient duplicate
// rank. Used by drag-reorder, the rank-position submenu,
// and the arrow steppers.
export const reassignRanksByOrder = (orderedAsc: PropertyFieldOption[]): PropertyFieldOption[] => {
    const ranks = orderedAsc.map((o) => o.rank ?? 0).sort((a, b) => a - b);
    return orderedAsc.map((o, i) => ({...o, rank: ranks[i]}));
};

// Moves the option at fromIndexAsc to toIndexAsc (both zero-based positions in
// the ascending-rank ordering) and reassigns ranks to match the new order.
export const moveOptionByAscIndex = (
    options: PropertyFieldOption[],
    fromIndexAsc: number,
    toIndexAsc: number,
): PropertyFieldOption[] => {
    const asc = sortOptionsByRankAsc(options);
    if (fromIndexAsc < 0 || fromIndexAsc >= asc.length) {
        return options;
    }
    const clampedTo = Math.max(0, Math.min(toIndexAsc, asc.length - 1));
    const reordered = [...asc];
    const [moved] = reordered.splice(fromIndexAsc, 1);
    reordered.splice(clampedTo, 0, moved);
    return reassignRanksByOrder(reordered);
};

// Whether `rank` is a valid rank value for an option: a positive integer.
// Zero and empty are rejected.
export const isValidRank = (rank: number | undefined): rank is number =>
    typeof rank === 'number' && Number.isInteger(rank) && rank >= 1;

// Finds an option (other than the one at exemptIndex) already using `rank`.
// Returns undefined when the rank is free.
export const findRankCollision = (
    options: PropertyFieldOption[],
    rank: number,
    exemptIndex: number,
): PropertyFieldOption | undefined =>
    options.find((option, index) => index !== exemptIndex && option.rank === rank);
