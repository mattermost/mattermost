// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {oxfordJoinNames} from './text';

export type GraphOccurrence = {
    key: string;
    valueKey: string;
    parentKey: string | null;
    option: PropertyFieldOption;
    depth: number;
    alsoUnder: string[];
    children: GraphOccurrence[];
};

export type OccurrenceKeyOf = (args: {
    option: PropertyFieldOption;
    valueKey: string;
    parentKey: string | null;
    path: string[];
}) => string;

export type ExpandOccurrencesOpts = {
    keyOf: OccurrenceKeyOf;
    depthCap?: number;
    budget?: number;
    rootDepth?: number;
};

type ExpandIndex = {
    byId: Map<string, PropertyFieldOption>;
    parentKeysByChildKey: Map<string, string[]>;
    childKeysByParentKey: Map<string, string[]>;
    rootKeys: string[];
};

function fallbackOption(valueKey: string): PropertyFieldOption {
    return {id: valueKey, name: valueKey, parents: []};
}

export function expandOccurrences(index: ExpandIndex, opts: ExpandOccurrencesOpts): GraphOccurrence[] {
    const {keyOf, depthCap, budget} = opts;
    const rootDepth = opts.rootDepth ?? 0;
    let emitted = 0;

    const expand = (
        valueKey: string,
        parentKey: string | null,
        depth: number,
        ancestors: Set<string>,
        path: string[],
    ): GraphOccurrence => {
        const option = index.byId.get(valueKey) ?? fallbackOption(valueKey);
        const parentKeys = index.parentKeysByChildKey.get(valueKey) ?? [];
        const occurrence: GraphOccurrence = {
            key: keyOf({option, valueKey, parentKey, path}),
            valueKey,
            parentKey,
            option,
            depth,
            alsoUnder: parentKeys.
                filter((key) => key !== parentKey).
                map((key) => index.byId.get(key)?.name ?? key),
            children: [],
        };
        emitted++;

        if ((depthCap !== undefined && depth >= depthCap) || (budget !== undefined && emitted >= budget)) {
            return occurrence;
        }

        ancestors.add(valueKey);
        for (const childKey of index.childKeysByParentKey.get(valueKey) ?? []) {
            if (ancestors.has(childKey)) {
                continue;
            }
            occurrence.children.push(expand(childKey, valueKey, depth + 1, ancestors, [...path, childKey]));
            if (budget !== undefined && emitted >= budget) {
                break;
            }
        }
        ancestors.delete(valueKey);

        return occurrence;
    };

    const roots: GraphOccurrence[] = [];
    for (const rootKey of index.rootKeys) {
        roots.push(expand(rootKey, null, rootDepth, new Set<string>(), [rootKey]));
    }
    return roots;
}

// OccKeys of ancestors that must be open so every selected value is visible.
// selectedIds are value ids; one key may open several rows, which is intended.
export function expandToSelected(roots: GraphOccurrence[], selectedIds: Set<string>): Set<string> {
    const open = new Set<string>();
    if (selectedIds.size === 0) {
        return open;
    }

    // onPath is path-scoped (not key: shared keys would collapse sibling paths).
    // done memoises per node so reused occurrence objects stay linear; dropping it
    // went exponential on a 26-layer shared DAG.
    const onPath = new Set<GraphOccurrence>();
    const done = new Map<GraphOccurrence, boolean>();

    const walk = (node: GraphOccurrence): boolean => {
        const cached = done.get(node);
        if (cached !== undefined) {
            return cached;
        }
        if (onPath.has(node)) {
            return false;
        }
        onPath.add(node);

        let holdsSelected = false;
        for (const child of node.children) {
            if (walk(child)) {
                holdsSelected = true;
            }
        }
        onPath.delete(node);

        if (holdsSelected) {
            open.add(node.key);
        }

        const result = holdsSelected || selectedIds.has(node.valueKey);
        done.set(node, result);

        return result;
    };

    for (const root of roots) {
        walk(root);
    }

    return open;
}

export function selectedDescendantCount(node: GraphOccurrence, selectedIds: Set<string>): number {
    if (selectedIds.size === 0) {
        return 0;
    }

    const seen = new Set<string>([node.valueKey]);
    const pending = [...node.children];
    let count = 0;

    while (pending.length > 0) {
        const current = pending.pop() as GraphOccurrence;
        if (seen.has(current.valueKey)) {
            continue;
        }
        seen.add(current.valueKey);
        if (selectedIds.has(current.valueKey)) {
            count++;
        }
        for (const child of current.children) {
            pending.push(child);
        }
    }

    return count;
}

export function alsoUnderLabel(otherParentNames: string[]): string {
    return oxfordJoinNames(otherParentNames);
}
