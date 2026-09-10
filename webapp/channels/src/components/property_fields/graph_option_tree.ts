// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

export type GraphOccurrence = {

    // `${parentId ?? ''}::${valueId}`. Sibling React/expand key, not a node id —
    // multi-parent values share one key so they open together.
    occKey: string;
    valueId: string;
    parentId: string | null;
    label: string;
    alsoUnder: string[];

    // Also empty when expansion hit the occurrence budget; search still finds those values.
    children: GraphOccurrence[];
};

export type GraphSearchRow = {
    valueId: string;
    label: string;

    // First-parent chain (`A › B › C` or `A › B · +2`). May start mid-graph.
    path: string;
};

export type GraphOptionJoin = {
    byId: Map<string, PropertyFieldOption>;
    byExactName: Map<string, PropertyFieldOption>;

    // Every root is seated; budget truncates subtrees, not top-level rows.
    roots: GraphOccurrence[];
};

const MAX_OCCURRENCE_DEPTH = 100;

// Server limits do not bound path count (a shallow diamond is 2^n). Search is
// flat, so a truncated occurrence is still findable.
const MIN_OCCURRENCE_BUDGET = 5000;
const OCCURRENCE_BUDGET_PER_OPTION = 4;
const MAX_EXTRA_PATHS = 99;

const PATH_SEPARATOR = ' › ';
const EXTRA_PATHS_SEPARATOR = ' · ';

// Duplicated from graph_utils so Account Settings does not import authoring.
function oxfordJoinNames(names: string[]): string {
    if (names.length === 0) {
        return '';
    }
    if (names.length === 1) {
        return names[0];
    }
    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function occKeyFor(parentId: string | null, valueId: string): string {
    return `${parentId ?? ''}::${valueId}`;
}

type GraphIndex = {
    byId: Map<string, PropertyFieldOption>;
    byExactName: Map<string, PropertyFieldOption>;
    parentIdsByChildId: Map<string, string[]>;
    childIdsByParentId: Map<string, string[]>;
    rootIds: string[];

    order: string[];
};

function indexOptions(options: PropertyFieldOption[]): GraphIndex {
    const byId = new Map<string, PropertyFieldOption>();
    const byExactName = new Map<string, PropertyFieldOption>();
    const order: string[] = [];

    for (const option of options) {
        if (!byId.has(option.id)) {
            byId.set(option.id, option);
            order.push(option.id);
        }
        if (!byExactName.has(option.name)) {
            byExactName.set(option.name, option);
        }
    }

    const parentIdsByChildId = new Map<string, string[]>();
    const childIdsByParentId = new Map<string, string[]>();
    const rootIds: string[] = [];

    for (const childId of order) {
        const option = byId.get(childId) as PropertyFieldOption;
        const parentIds: string[] = [];

        for (const parentName of option.parents ?? []) {
            const parent = byExactName.get(parentName);
            if (!parent || parent.id === childId || parentIds.includes(parent.id)) {
                continue;
            }
            parentIds.push(parent.id);
        }
        parentIdsByChildId.set(childId, parentIds);

        if (parentIds.length === 0) {
            rootIds.push(childId);
            continue;
        }
        for (const parentId of parentIds) {
            const siblings = childIdsByParentId.get(parentId);
            if (siblings) {
                siblings.push(childId);
            } else {
                childIdsByParentId.set(parentId, [childId]);
            }
        }
    }

    return {byId, byExactName, parentIdsByChildId, childIdsByParentId, rootIds, order};
}

export function joinGraphOptions(options: PropertyFieldOption[]): GraphOptionJoin {
    const index = indexOptions(options);
    const budget = Math.max(MIN_OCCURRENCE_BUDGET, options.length * OCCURRENCE_BUDGET_PER_OPTION);
    let emitted = 0;

    const expand = (valueId: string, parentId: string | null, depth: number, ancestors: Set<string>): GraphOccurrence => {
        const parentIds = index.parentIdsByChildId.get(valueId) ?? [];
        const occurrence: GraphOccurrence = {
            occKey: occKeyFor(parentId, valueId),
            valueId,
            parentId,
            label: index.byId.get(valueId)?.name ?? valueId,
            alsoUnder: parentIds.
                filter((id) => id !== parentId).
                map((id) => index.byId.get(id)?.name ?? id),
            children: [],
        };
        emitted++;

        if (depth >= MAX_OCCURRENCE_DEPTH || emitted >= budget) {
            return occurrence;
        }

        ancestors.add(valueId);
        for (const childId of index.childIdsByParentId.get(valueId) ?? []) {
            if (ancestors.has(childId)) {
                continue;
            }
            occurrence.children.push(expand(childId, valueId, depth + 1, ancestors));
            if (emitted >= budget) {
                break;
            }
        }
        ancestors.delete(valueId);

        return occurrence;
    };

    const roots: GraphOccurrence[] = [];
    for (const rootId of index.rootIds) {
        roots.push(expand(rootId, null, 1, new Set<string>()));
    }

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

function firstParentPath(valueId: string, index: GraphIndex): string {
    const labels: string[] = [];
    const onPath = new Set<string>([valueId]);
    let current = valueId;

    for (let step = 0; step < MAX_OCCURRENCE_DEPTH; step++) {
        const parentId = (index.parentIdsByChildId.get(current) ?? [])[0];
        if (parentId === undefined || onPath.has(parentId)) {
            break;
        }
        onPath.add(parentId);
        labels.push(index.byId.get(parentId)?.name ?? parentId);
        current = parentId;
    }

    return labels.reverse().join(PATH_SEPARATOR);
}

function countRootPaths(valueId: string, index: GraphIndex, memo: Map<string, number>, onPath: Set<string>): number {
    const cached = memo.get(valueId);
    if (cached !== undefined) {
        return cached;
    }
    if (onPath.has(valueId)) {
        return 0;
    }

    const parentIds = index.parentIdsByChildId.get(valueId) ?? [];
    if (parentIds.length === 0) {
        memo.set(valueId, 1);
        return 1;
    }

    onPath.add(valueId);
    let total = 0;
    for (const parentId of parentIds) {
        total += countRootPaths(parentId, index, memo, onPath);
        if (total > MAX_EXTRA_PATHS) {
            total = MAX_EXTRA_PATHS + 1;
            break;
        }
    }
    onPath.delete(valueId);

    memo.set(valueId, total);
    return total;
}

export function flattenSearch(options: PropertyFieldOption[], query: string): GraphSearchRow[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
        return [];
    }

    const index = indexOptions(options);
    const memo = new Map<string, number>();
    const rows: GraphSearchRow[] = [];

    for (const valueId of index.order) {
        const option = index.byId.get(valueId) as PropertyFieldOption;
        if (!option.name.toLowerCase().includes(needle)) {
            continue;
        }

        const path = firstParentPath(valueId, index);
        const paths = Math.max(1, countRootPaths(valueId, index, memo, new Set<string>()));
        const extra = paths - 1;

        rows.push({
            valueId,
            label: option.name,
            path: extra > 0 ? `${path}${EXTRA_PATHS_SEPARATOR}+${extra}` : path,
        });
    }

    return rows;
}

// OccKeys of ancestors that must be open so every selected value is visible.
// selectedIds are value ids; one occKey may open several rows, which is intended.
export function expandToSelected(roots: GraphOccurrence[], selectedIds: Set<string>): Set<string> {
    const open = new Set<string>();
    if (selectedIds.size === 0) {
        return open;
    }

    // onPath is path-scoped (not occKey: shared keys would collapse sibling paths).
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
            open.add(node.occKey);
        }

        const result = holdsSelected || selectedIds.has(node.valueId);
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

    const seen = new Set<string>([node.valueId]);
    const pending = [...node.children];
    let count = 0;

    while (pending.length > 0) {
        const current = pending.pop() as GraphOccurrence;
        if (seen.has(current.valueId)) {
            continue;
        }
        seen.add(current.valueId);
        if (selectedIds.has(current.valueId)) {
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
