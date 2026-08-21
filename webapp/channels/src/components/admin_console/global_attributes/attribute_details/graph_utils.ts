// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    GRAPH_MAX_DEPTH,
    GRAPH_MAX_EDGES,
    GRAPH_MAX_OPTIONS,
    GRAPH_MAX_PARENTS_PER_VALUE,
} from '../constants';

type ParentEdgeOpts = {
    removeParent?: string | null;
};

function parentsOf(option: PropertyFieldOption | undefined): string[] {
    return option?.parents ?? [];
}

function optionByName(options: PropertyFieldOption[], name: string): PropertyFieldOption | undefined {
    return options.find((option) => option.name === name);
}

/** child name → parent names. Missing nodes (new child on add) → []. */
function parentAdj(options: PropertyFieldOption[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const option of options) {
        adj.set(option.name, [...parentsOf(option)]);
    }
    return adj;
}

/** parent name → child names, preserving options-array order. */
function childAdj(options: PropertyFieldOption[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();
    for (const option of options) {
        for (const parentName of parentsOf(option)) {
            const children = adj.get(parentName);
            if (children) {
                children.push(option.name);
            } else {
                adj.set(parentName, [option.name]);
            }
        }
    }
    return adj;
}

/**
 * Immutable copy: drop `removeParent` from `childName` if set, then append
 * `parentName` if not already present. If `childName` is not in `options`
 * (new child), append `{id: '', name: childName, parents: [parentName]}`.
 * If `parentName` is not in `options`, leave it absent — walks treat missing
 * nodes as isolated (server: unknown endpoints are options with nothing around them).
 */
function withProposedEdge(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): PropertyFieldOption[] {
    let found = false;
    const next = options.map((option) => {
        if (option.name !== childName) {
            return option;
        }
        found = true;
        let parents = [...parentsOf(option)];
        if (typeof opts?.removeParent === 'string') {
            parents = parents.filter((parent) => parent !== opts.removeParent);
        }
        if (!parents.includes(parentName)) {
            parents.push(parentName);
        }
        return {...option, parents};
    });
    if (!found) {
        next.push({id: '', name: childName, parents: [parentName]});
    }
    return next;
}

/**
 * start plus every strict descendant (holders of start can reach these).
 * BFS/DFS via childAdj. Used by grant-confirm. Includes start.
 */
function reachableDown(options: PropertyFieldOption[], start: string): Set<string> {
    const children = childAdj(options);
    const reached = new Set<string>();
    const pending = [start];
    while (pending.length > 0) {
        const node = pending.pop() as string;
        if (reached.has(node)) {
            continue;
        }
        reached.add(node);
        const next = children.get(node) ?? [];
        for (let i = 0; i < next.length; i++) {
            pending.push(next[i]);
        }
    }
    return reached;
}

/**
 * Longest option-chain from `start` following `adjacency`. Start counts as 1.
 * Memoized DFS. Visiting a node already on the stack → cycle; return 0
 * (caller must have run wouldCreateCycle). Finished nodes reuse memo (diamond).
 *
 * G2: this is chain length, NOT |unique nodes|. Taking max over neighbors
 * (not parents[0], not a Set of ancestors) is what makes diamond = 3 and
 * uneven = 4.
 */
function longestChain(
    start: string,
    adjacency: Map<string, string[]>,
    memo: Map<string, number>,
    visiting: Set<string>,
): number {
    const cached = memo.get(start);
    if (cached !== undefined) {
        return cached;
    }
    if (visiting.has(start)) {
        return 0;
    }
    visiting.add(start);
    const next = adjacency.get(start) ?? [];
    const length = next.length === 0 ? 1 : 1 + Math.max(...next.map((n) => longestChain(n, adjacency, memo, visiting)));
    visiting.delete(start);
    memo.set(start, length);
    return length;
}

export function isNameUnique(
    options: PropertyFieldOption[],
    candidate: string,
    excludeName?: string,
): boolean {
    const candidateKey = candidate.trim().toLowerCase();
    const excludeKey = excludeName === undefined ? undefined : excludeName.trim().toLowerCase();
    for (const option of options) {
        const key = option.name.trim().toLowerCase();
        if (excludeKey !== undefined && key === excludeKey) {
            continue;
        }
        if (key === candidateKey) {
            return false;
        }
    }
    return true;
}

export function hasCaseInsensitiveDuplicateNames(options: PropertyFieldOption[]): boolean {
    return options.some((option, index) =>
        !isNameUnique(
            options.filter((_, i) => i !== index),
            option.name,
        ),
    );
}

export function hasBlankTrimmedOptionName(options: PropertyFieldOption[]): boolean {
    return options.some((option) => option.name.trim() === '');
}

export function getChildren(options: PropertyFieldOption[], parentName: string): PropertyFieldOption[] {
    return options.filter((option) => parentsOf(option).includes(parentName));
}

export function getRoots(options: PropertyFieldOption[]): PropertyFieldOption[] {
    return options.filter((option) => parentsOf(option).length === 0);
}

export function countEdges(options: PropertyFieldOption[]): number {
    let total = 0;
    for (const option of options) {
        total += parentsOf(option).length;
    }
    return total;
}

export function findOrphansAfterDelete(options: PropertyFieldOption[], optionName: string): PropertyFieldOption[] {
    return options.filter((option) => {
        const parents = parentsOf(option);
        if (!parents.includes(optionName)) {
            return false;
        }
        return parents.filter((parent) => parent !== optionName).length === 0;
    });
}

export function findAncestors(options: PropertyFieldOption[], optionName: string): string[] {
    const adj = parentAdj(options);
    const ancestors = new Set<string>();
    const pending = [...(adj.get(optionName) ?? [])];
    while (pending.length > 0) {
        const node = pending.pop() as string;
        if (node === optionName || ancestors.has(node)) {
            continue;
        }
        ancestors.add(node);
        const next = adj.get(node) ?? [];
        for (let i = 0; i < next.length; i++) {
            pending.push(next[i]);
        }
    }
    return [...ancestors];
}

export function oxfordJoinNames(names: string[]): string {
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

export function computeDepthAfterAdd(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): number {
    // G2: do NOT return longestChain over the whole graph (sibling add would be 3).
    // G2: do NOT return 1 + uniqueAncestors(child) (diamond close would be 4).
    // G2: do NOT walk only parents[0] (uneven D.parents=[B,E] would be 3).
    const after = withProposedEdge(options, childName, parentName, opts);
    const above = longestChain(parentName, parentAdj(after), new Map(), new Set());
    const below = longestChain(childName, childAdj(after), new Map(), new Set());
    return above + below;
}

export function wouldCreateCycle(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): boolean {
    if (childName === parentName) {
        return true;
    }
    const after = withProposedEdge(options, childName, parentName, opts);
    return findAncestors(after, parentName).includes(childName);
}

export function wouldExceedMaxParents(
    options: PropertyFieldOption[],
    childName: string,
    opts?: {replacingParent?: string | null},
): boolean {
    const current = parentsOf(optionByName(options, childName)).length;
    if (typeof opts?.replacingParent === 'string') {
        const parents = parentsOf(optionByName(options, childName));
        const remaining = parents.includes(opts.replacingParent) ? current - 1 : current;
        return remaining + 1 > GRAPH_MAX_PARENTS_PER_VALUE;
    }
    return current >= GRAPH_MAX_PARENTS_PER_VALUE;
}

export function wouldExceedMaxOptions(options: PropertyFieldOption[]): boolean {
    return options.length >= GRAPH_MAX_OPTIONS;
}

export function wouldExceedMaxEdges(options: PropertyFieldOption[]): boolean {
    return countEdges(options) >= GRAPH_MAX_EDGES;
}

export function findNewlyReachableDescendants(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): string[] {
    // 1. before = reachable(parent) on the CURRENT graph (include parent + descendants).
    const before = reachableDown(options, parentName);

    // 2. after = user action: if removeParent, drop that occurrence edge, then add parentName.
    const after = withProposedEdge(options, childName, parentName, opts);

    // 3. newly = reachable(parent, after) − before, then drop the child.
    //    Product list is descendants-only (G13). Grant row already names the child.
    const newly = reachableDown(after, parentName);
    newly.delete(childName);
    for (const n of before) {
        newly.delete(n);
    }

    // G3: do NOT compute “already reachable” on the reduced (after_remove) graph.
    // Reparent C from R onto ancestor P on P→R→C→D must return [] .
    // after_remove would report {C, D} and over-confirm.
    return [...newly];
}

export type CheckParentEdgeResult =
    | {ok: false; error: 'self'}
    | {ok: false; error: 'cycle'}
    | {ok: false; error: 'depth'; depth: number}
    | {ok: false; error: 'max-parents'}
    | {ok: true; noOp: true}
    | {ok: true; noOp?: false; newlyReachable: string[]; ancestorsOfParent: string[]};

export function checkParentEdge(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): CheckParentEdgeResult {
    if (childName === parentName) {
        return {ok: false, error: 'self'};
    }

    // G4: duplicate parent-edge is a silent no-op. Never 'duplicate-edge'.
    // Do not inspect removeParent: if the new parent is already held, it is a
    // no-op even when replacing a different occurrence.
    if (parentsOf(optionByName(options, childName)).includes(parentName)) {
        return {ok: true, noOp: true};
    }

    if (wouldCreateCycle(options, childName, parentName, opts)) {
        return {ok: false, error: 'cycle'};
    }

    const depth = computeDepthAfterAdd(options, childName, parentName, opts);
    if (depth > GRAPH_MAX_DEPTH) {
        return {ok: false, error: 'depth', depth};
    }

    if (wouldExceedMaxParents(options, childName, {replacingParent: opts?.removeParent})) {
        return {ok: false, error: 'max-parents'};
    }

    return {
        ok: true,
        newlyReachable: findNewlyReachableDescendants(options, childName, parentName, opts),
        ancestorsOfParent: findAncestors(options, parentName),
    };
}

export function addTopLevelOption(options: PropertyFieldOption[], name: string): PropertyFieldOption[] {
    return [...options, {id: '', name: name.trim(), parents: []}];
}

export function addChildOption(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
): PropertyFieldOption[] {
    return [...options, {id: '', name: childName.trim(), parents: [parentName]}];
}

export function renameOption(
    options: PropertyFieldOption[],
    oldName: string,
    newName: string,
): PropertyFieldOption[] {
    if (newName.trim() === '') {
        return options;
    }
    const trimmed = newName.trim();
    return options.map((option) => {
        const renamed = option.name === oldName;
        const parents = parentsOf(option);
        const pointsAtOld = parents.includes(oldName);
        if (!renamed && !pointsAtOld) {
            return option;
        }
        return {
            ...option,
            name: renamed ? trimmed : option.name,
            parents: pointsAtOld ? parents.map((parent) => (parent === oldName ? trimmed : parent)) : [...parents],
        };
    });
}

export function addParentEdge(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
): PropertyFieldOption[] {
    return options.map((option) => {
        if (option.name !== childName) {
            return option;
        }
        const parents = parentsOf(option);
        if (parents.includes(parentName)) {
            return option;
        }
        return {...option, parents: [...parents, parentName]};
    });
}

export function replaceOccurrenceParent(
    options: PropertyFieldOption[],
    childName: string,
    oldParentName: string | null,
    newParentName: string,
): PropertyFieldOption[] {
    return options.map((option) => {
        if (option.name !== childName) {
            return option;
        }
        let parents = [...parentsOf(option)];
        if (oldParentName !== null) {
            parents = parents.filter((parent) => parent !== oldParentName);
        }
        if (!parents.includes(newParentName)) {
            parents.push(newParentName);
        }
        return {...option, parents};
    });
}

export function removeParentEdge(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
): PropertyFieldOption[] {
    return options.map((option) => {
        if (option.name !== childName) {
            return option;
        }
        return {
            ...option,
            parents: parentsOf(option).filter((parent) => parent !== parentName),
        };
    });
}

export function removeOption(options: PropertyFieldOption[], optionName: string): PropertyFieldOption[] {
    return options.filter((option) => option.name !== optionName).map((option) => {
        const parents = parentsOf(option);
        if (!parents.includes(optionName)) {
            return option;
        }
        return {
            ...option,
            parents: parents.filter((parent) => parent !== optionName),
        };
    });
}

export const GRAPH_CYCLE_ERROR_DEFAULT =
    "{parent} can't be a parent of {child} — {child} already grants {parent}, so this would loop back on itself.";

export const GRAPH_UNIQUENESS_ERROR_DEFAULT =
    '"{name}" already exists in this field.';

export const GRAPH_DEPTH_ERROR_DEFAULT =
    'Adding this parent pushes "{name}" to depth {n}; the limit is 100.';

export const GRAPH_MAX_PARENTS_ERROR_DEFAULT =
    'An option can have at most 100 parents.';

export function cycleErrorValues(parentName: string, childName: string): {parent: string; child: string} {
    return {parent: parentName, child: childName};
}

export function uniquenessErrorValues(name: string): {name: string} {
    return {name};
}

export function depthErrorValues(name: string, depth: number): {name: string; n: number} {
    return {name, n: depth};
}
