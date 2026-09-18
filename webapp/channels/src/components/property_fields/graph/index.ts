// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {GRAPH_MAX_DEPTH, GRAPH_MAX_SEARCH_ROWS} from './limits';
import {expandOccurrences} from './occurrences';
import type {GraphOccurrence, OccurrenceKeyOf} from './occurrences';

export {expandOccurrences, expandToSelected, selectedDescendantCount, alsoUnderLabel} from './occurrences';
export type {GraphOccurrence, OccurrenceKeyOf, ExpandOccurrencesOpts} from './occurrences';
export {oxfordJoinNames} from './text';
export {
    GRAPH_MAX_DEPTH,
    GRAPH_MAX_EDGES,
    GRAPH_MAX_OPTIONS,
    GRAPH_MAX_PARENTS_PER_VALUE,
    GRAPH_MAX_SEARCH_ROWS,
} from './limits';

export type GraphSearchRow = {
    valueId: string;
    label: string;

    // First-parent chain (`A › B › C` or `A › B · +2`). May start mid-graph.
    path: string;
};

export type GraphSearchResult = {
    rows: GraphSearchRow[];
    truncated: boolean;
};

export function asGraphValueIds(value: string | string[] | undefined): string[] {
    if (Array.isArray(value)) {
        return value;
    }
    return value ? [value] : [];
}

export type GraphOptionJoin = {
    byId: Map<string, PropertyFieldOption>;
    byExactName: Map<string, PropertyFieldOption>;

    // Every root is seated; budget truncates subtrees, not top-level rows.
    roots: GraphOccurrence[];
};

// Server limits do not bound path count (a shallow diamond is 2^n). Search is
// flat, so a truncated occurrence is still findable.
const MIN_OCCURRENCE_BUDGET = 5000;
const OCCURRENCE_BUDGET_PER_OPTION = 4;
const MAX_EXTRA_PATHS = 99;

const PATH_SEPARATOR = ' › ';
const EXTRA_PATHS_SEPARATOR = ' · ';
export const OCCURRENCE_KEY_SEPARATOR = '\0';

export function optionKey(option: PropertyFieldOption): string {
    return option.id || option.name;
}

export type GraphIndex = {
    byId: Map<string, PropertyFieldOption>; // keyed by optionKey
    byExactName: Map<string, PropertyFieldOption>;
    parentKeysByChildKey: Map<string, string[]>;
    childKeysByParentKey: Map<string, string[]>;
    rootKeys: string[];
    order: string[];
};

export const pickerOccurrenceKey: OccurrenceKeyOf = ({parentKey, valueKey}) =>
    `${parentKey ?? ''}::${valueKey}`;

export const canvasOccurrenceKey: OccurrenceKeyOf = ({path}) => path.join(OCCURRENCE_KEY_SEPARATOR);

export function indexOptions(options: PropertyFieldOption[]): GraphIndex {
    const byId = new Map<string, PropertyFieldOption>();
    const byExactName = new Map<string, PropertyFieldOption>();
    const order: string[] = [];

    for (const option of options) {
        const key = optionKey(option);
        if (!byId.has(key)) {
            byId.set(key, option);
            order.push(key);
        }
        if (!byExactName.has(option.name)) {
            byExactName.set(option.name, option);
        }
    }

    const parentKeysByChildKey = new Map<string, string[]>();
    const childKeysByParentKey = new Map<string, string[]>();
    const rootKeys: string[] = [];

    for (const childKey of order) {
        const option = byId.get(childKey) as PropertyFieldOption;
        const parentKeys: string[] = [];

        for (const parentName of option.parents ?? []) {
            const parent = byExactName.get(parentName);
            if (!parent) {
                continue;
            }
            const parentKey = optionKey(parent);
            if (parentKey === childKey || parentKeys.includes(parentKey)) {
                continue;
            }
            parentKeys.push(parentKey);
        }
        parentKeysByChildKey.set(childKey, parentKeys);

        if (parentKeys.length === 0) {
            rootKeys.push(childKey);
            continue;
        }
        for (const parentKey of parentKeys) {
            const siblings = childKeysByParentKey.get(parentKey);
            if (siblings) {
                siblings.push(childKey);
            } else {
                childKeysByParentKey.set(parentKey, [childKey]);
            }
        }
    }

    return {byId, byExactName, parentKeysByChildKey, childKeysByParentKey, rootKeys, order};
}

export function joinGraphOptions(options: PropertyFieldOption[]): GraphOptionJoin {
    const index = indexOptions(options);
    const budget = Math.max(MIN_OCCURRENCE_BUDGET, options.length * OCCURRENCE_BUDGET_PER_OPTION);
    const roots = expandOccurrences(index, {
        keyOf: pickerOccurrenceKey,
        depthCap: GRAPH_MAX_DEPTH,
        budget,
        rootDepth: 1,
    });
    return {byId: index.byId, byExactName: index.byExactName, roots};
}

export function hydrateNameToId(name: string, byExactName: Map<string, PropertyFieldOption>): string | undefined {
    const id = byExactName.get(name)?.id;
    return id || undefined;
}

export function emitIdToName(id: string, byId: Map<string, PropertyFieldOption>, fallback?: string): string {
    const name = byId.get(id)?.name;
    if (name) {
        return name;
    }
    if (fallback) {
        return fallback;
    }
    return id;
}

function firstParentPath(valueKey: string, index: GraphIndex): string {
    const labels: string[] = [];
    const onPath = new Set<string>([valueKey]);
    let current = valueKey;

    for (let step = 0; step < GRAPH_MAX_DEPTH; step++) {
        const parentKey = (index.parentKeysByChildKey.get(current) ?? [])[0];
        if (parentKey === undefined || onPath.has(parentKey)) {
            break;
        }
        onPath.add(parentKey);
        labels.push(index.byId.get(parentKey)?.name ?? parentKey);
        current = parentKey;
    }

    return labels.reverse().join(PATH_SEPARATOR);
}

function countRootPaths(valueKey: string, index: GraphIndex, memo: Map<string, number>, onPath: Set<string>): number {
    const cached = memo.get(valueKey);
    if (cached !== undefined) {
        return cached;
    }
    if (onPath.has(valueKey)) {
        return 0;
    }

    const parentKeys = index.parentKeysByChildKey.get(valueKey) ?? [];
    if (parentKeys.length === 0) {
        memo.set(valueKey, 1);
        return 1;
    }

    onPath.add(valueKey);
    let total = 0;
    for (const parentKey of parentKeys) {
        total += countRootPaths(parentKey, index, memo, onPath);
        if (total > MAX_EXTRA_PATHS) {
            total = MAX_EXTRA_PATHS + 1;
            break;
        }
    }
    onPath.delete(valueKey);

    memo.set(valueKey, total);
    return total;
}

export function flattenSearch(options: PropertyFieldOption[], query: string): GraphSearchResult {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
        return {rows: [], truncated: false};
    }

    const index = indexOptions(options);
    const memo = new Map<string, number>();
    const rows: GraphSearchRow[] = [];

    for (const valueKey of index.order) {
        const option = index.byId.get(valueKey) as PropertyFieldOption;
        if (!option.name.toLowerCase().includes(needle)) {
            continue;
        }

        if (rows.length >= GRAPH_MAX_SEARCH_ROWS) {
            return {rows, truncated: true};
        }

        const path = firstParentPath(valueKey, index);
        const paths = Math.max(1, countRootPaths(valueKey, index, memo, new Set<string>()));
        const extra = paths - 1;

        rows.push({
            valueId: option.id || valueKey,
            label: option.name,
            path: extra > 0 ? `${path}${EXTRA_PATHS_SEPARATOR}+${extra}` : path,
        });
    }

    return {rows, truncated: false};
}
