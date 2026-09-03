// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function toValueList(value: unknown, maxItems?: number): unknown[] {
    if (value === null || value === undefined || value === '') {
        return [];
    }

    const list = Array.isArray(value) ? value : [value];

    return maxItems === undefined ? list : list.slice(0, Math.max(0, maxItems));
}
