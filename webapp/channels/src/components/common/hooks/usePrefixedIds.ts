// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';

/**
 * Combines the given prefix with a number of suffixes to generate IDs for the children of a component.
 */
export default function usePrefixedIds<S extends Record<string, unknown>>(prefix: string, suffixes: S): {[K in keyof S]: string} {
    // This hook assumes that suffixes never change, so use the original version unless prefix changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedSuffixes = useMemo(() => suffixes, [prefix]);

    return useMemo(() => {
        const childIds = {
            ...memoizedSuffixes,
        } as {[K in keyof S]: string};

        for (const suffix of Object.keys(memoizedSuffixes)) {
            childIds[suffix as keyof S] = `${prefix}-${suffix}`;
        }

        return childIds;
    }, [prefix, memoizedSuffixes]);
}

export function joinIds(...ids: string[]): string {
    return ids.filter(Boolean).join(' ');
}
