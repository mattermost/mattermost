// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {
    GRAPH_MAX_DEPTH,
    GRAPH_MAX_PARENTS_PER_VALUE,
    indexOptions,
    optionKey,
    type GraphIndex,
} from 'components/property_fields/graph';

import {
    checkParentEdgeValidity,
    isNameUnique,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
} from './graph_utils';

export type EdgeDirection = 'parents' | 'children';

export type ParentCandidateClass =
    | {kind: 'omit'} |
    {kind: 'disabled'; reason: 'self' | 'depth' | 'max-parents'} |
    {kind: 'enabled'};

export type Suggestion =
    {kind: 'existing'; name: string} |
    {kind: 'create'; name: string};

export function classifyParentCandidate(
    options: PropertyFieldOption[],
    childName: string,
    candidateName: string,
): ParentCandidateClass {
    const listed = (options.find((o) => o.name === childName)?.parents ?? []).includes(candidateName);
    if (listed) {
        return {kind: 'omit'};
    }
    const result = checkParentEdgeValidity(options, childName, candidateName);
    if (!result.ok) {
        switch (result.error) {
        case 'cycle':
            return {kind: 'omit'};
        case 'self':
            return {kind: 'disabled', reason: 'self'};
        case 'depth':
            return {kind: 'disabled', reason: 'depth'};
        case 'max-parents':
            return {kind: 'disabled', reason: 'max-parents'};
        default: {
            const exhaustive: never = result;
            return exhaustive;
        }
        }
    }
    return {kind: 'enabled'};
}

export function enabledSuggestionNames(
    options: PropertyFieldOption[],
    optionName: string,
    direction: EdgeDirection,
): string[] {
    const index = indexOptions(options);
    const ancestors = walkNames(index, optionName, index.parentKeysByChildKey);
    const descendants = walkNames(index, optionName, index.childKeysByParentKey);
    const longestUp = longestByKey(index.parentKeysByChildKey, index.order);
    const longestDown = longestByKey(index.childKeysByParentKey, index.order);

    const parentsByName = new Map<string, string[]>();
    for (const option of options) {
        if (!parentsByName.has(option.name)) {
            parentsByName.set(option.name, option.parents ?? []);
        }
    }

    const optionParentCount = parentsByName.get(optionName)?.length ?? 0;
    const optionAtMaxParents = optionParentCount >= GRAPH_MAX_PARENTS_PER_VALUE;

    const names: string[] = [];
    for (const candidate of options) {
        const childName = direction === 'children' ? candidate.name : optionName;
        const parentName = direction === 'children' ? optionName : candidate.name;

        if ((parentsByName.get(childName) ?? []).includes(parentName)) {
            continue;
        }
        if (childName === parentName) {
            continue;
        }

        switch (direction) {
        case 'parents':
            if (descendants.has(candidate.name)) {
                continue;
            }
            break;
        case 'children':
            if (ancestors.has(candidate.name)) {
                continue;
            }
            break;
        default: {
            const exhaustive: never = direction;
            return exhaustive;
        }
        }

        const parentKey = keyOfName(index, parentName);
        const childKey = keyOfName(index, childName);
        const above = parentKey === undefined ? 1 : (longestUp.get(parentKey) ?? 1);
        const below = childKey === undefined ? 1 : (longestDown.get(childKey) ?? 1);
        if (above + below > GRAPH_MAX_DEPTH) {
            continue;
        }

        if (direction === 'parents') {
            if (optionAtMaxParents) {
                continue;
            }
        } else if ((candidate.parents?.length ?? 0) >= GRAPH_MAX_PARENTS_PER_VALUE) {
            continue;
        }

        names.push(candidate.name);
    }
    return names;
}

export function buildSuggestions(
    options: PropertyFieldOption[],
    enabledNames: string[],
    query: string,
    opts: {disabled: boolean; atMax: boolean},
): Suggestion[] {
    const q = query.trim();
    const qLower = q.toLowerCase();
    const items: Suggestion[] = [];
    for (const name of enabledNames) {
        if (q && !name.toLowerCase().includes(qLower)) {
            continue;
        }
        items.push({kind: 'existing', name});
    }
    if (q && isNameUnique(options, q) && !opts.disabled && !opts.atMax && !wouldExceedMaxOptions(options) && !wouldExceedMaxEdges(options)) {
        items.push({kind: 'create', name: q});
    }
    return items;
}

function keyOfName(index: GraphIndex, name: string): string | undefined {
    const option = index.byExactName.get(name);
    return option ? optionKey(option) : undefined;
}

function nameOfKey(index: GraphIndex, key: string): string {
    return index.byId.get(key)?.name ?? key;
}

function walkNames(index: GraphIndex, startName: string, adjacency: Map<string, string[]>): Set<string> {
    const startKey = keyOfName(index, startName);
    if (startKey === undefined) {
        return new Set([startName]);
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
        const next = adjacency.get(node) ?? [];
        for (let i = 0; i < next.length; i++) {
            pending.push(next[i]);
        }
    }
    return reached;
}

function longestByKey(adjacency: Map<string, string[]>, keys: string[]): Map<string, number> {
    const memo = new Map<string, number>();
    const visiting = new Set<string>();
    const visit = (start: string): number => {
        const cached = memo.get(start);
        if (cached !== undefined) {
            return cached;
        }
        if (visiting.has(start)) {
            return 0;
        }
        visiting.add(start);
        const next = adjacency.get(start) ?? [];
        const length = next.length === 0 ? 1 : 1 + Math.max(...next.map((n) => visit(n)));
        visiting.delete(start);
        memo.set(start, length);
        return length;
    };
    for (const key of keys) {
        visit(key);
    }
    return memo;
}
