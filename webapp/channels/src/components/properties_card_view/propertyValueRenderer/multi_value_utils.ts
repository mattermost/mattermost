// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function toValueList(value: unknown, maxItems?: number): unknown[] {
    if (value === null || value === undefined || value === '') {
        return [];
    }

    // An empty entry inside a stored list names nothing, so it is not an entry.
    // It is dropped before the cap, so it cannot spend a slot either.
    const list = (Array.isArray(value) ? value : [value]).
        filter((entry) => entry !== null && entry !== undefined && entry !== '');

    return maxItems === undefined ? list : list.slice(0, Math.max(0, maxItems));
}
