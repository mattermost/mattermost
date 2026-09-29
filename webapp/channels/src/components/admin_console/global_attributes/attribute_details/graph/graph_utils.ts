// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    GRAPH_MAX_DEPTH,
    GRAPH_MAX_EDGES,
    GRAPH_MAX_OPTIONS,
    GRAPH_MAX_PARENTS_PER_VALUE,
    indexOptions,
    optionKey,
} from 'components/property_fields/graph';

type ParentEdgeOpts = {
    removeParent?: string | null;
};

function parentsOf(option: PropertyFieldOption | undefined): string[] {
    return option?.parents ?? [];
}

function optionByName(options: PropertyFieldOption[], name: string): PropertyFieldOption | undefined {
    return options.find((option) => option.name === name);
}

function keyOfName(index: ReturnType<typeof indexOptions>, name: string): string | undefined {
    const option = index.byExactName.get(name);
    return option ? optionKey(option) : undefined;
}

function nameOfKey(index: ReturnType<typeof indexOptions>, key: string): string {
    return index.byId.get(key)?.name ?? key;
}

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

function reachableDown(options: PropertyFieldOption[], start: string): Set<string> {
    const index = indexOptions(options);
    const startKey = keyOfName(index, start);
    if (startKey === undefined) {
        return new Set([start]);
    }
    const reached = new Set<string>();
    const pending = [startKey];
    while (pending.length > 0) {
        const node = pending.pop() as string;
        const name = nameOfKey(index, node);
        if (reached.has(name)) {
            continue;
        }
        reached.add(name);
        const next = index.childKeysByParentKey.get(node) ?? [];
        for (let i = 0; i < next.length; i++) {
            pending.push(next[i]);
        }
    }
    return reached;
}

export function countDescendants(options: PropertyFieldOption[], name: string): number {
    return reachableDown(options, name).size - 1;
}

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
    const seen = new Set<string>();
    for (const option of options) {
        const key = option.name.trim().toLowerCase();
        if (seen.has(key)) {
            return true;
        }
        seen.add(key);
    }
    return false;
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
    const index = indexOptions(options);
    const startKey = keyOfName(index, optionName);
    if (startKey === undefined) {
        return [];
    }
    const ancestors = new Set<string>();
    const pending = [...(index.parentKeysByChildKey.get(startKey) ?? [])];
    while (pending.length > 0) {
        const node = pending.pop() as string;
        const name = nameOfKey(index, node);
        if (name === optionName || ancestors.has(name)) {
            continue;
        }
        ancestors.add(name);
        const next = index.parentKeysByChildKey.get(node) ?? [];
        for (let i = 0; i < next.length; i++) {
            pending.push(next[i]);
        }
    }
    return [...ancestors];
}

export function computeDepthAfterAdd(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): number {
    const after = withProposedEdge(options, childName, parentName, opts);
    const index = indexOptions(after);
    const parentKey = keyOfName(index, parentName);
    const childKey = keyOfName(index, childName);
    const above = parentKey === undefined ? 1 : longestChain(parentKey, index.parentKeysByChildKey, new Map(), new Set());
    const below = childKey === undefined ? 1 : longestChain(childKey, index.childKeysByParentKey, new Map(), new Set());
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
    const before = reachableDown(options, parentName);
    const after = withProposedEdge(options, childName, parentName, opts);
    const newly = reachableDown(after, parentName);
    newly.delete(childName);
    for (const n of before) {
        newly.delete(n);
    }
    return [...newly];
}

export type CheckParentEdgeInvalid =
    {ok: false; error: 'self'} |
    {ok: false; error: 'cycle'} |
    {ok: false; error: 'depth'; depth: number} |
    {ok: false; error: 'max-parents'};

export type CheckParentEdgeValidity =
    CheckParentEdgeInvalid |
    {ok: true; noOp: true} |
    {ok: true};

export type CheckParentEdgeResult =
    CheckParentEdgeInvalid |
    {ok: true; noOp: true} |
    {ok: true; noOp?: false; newlyReachable: string[]};

export function checkParentEdgeValidity(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): CheckParentEdgeValidity {
    if (childName === parentName) {
        return {ok: false, error: 'self'};
    }

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

    return {ok: true};
}

export function checkParentEdge(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    opts?: ParentEdgeOpts,
): CheckParentEdgeResult {
    const result = checkParentEdgeValidity(options, childName, parentName, opts);
    if (!result.ok || ('noOp' in result && result.noOp)) {
        return result;
    }
    return {
        ok: true,
        newlyReachable: findNewlyReachableDescendants(options, childName, parentName, opts),
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

