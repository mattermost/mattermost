// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

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
    const names: string[] = [];
    for (const candidate of options) {
        const classification = classifyForDirection(options, optionName, candidate.name, direction);
        if (classification.kind === 'enabled') {
            names.push(candidate.name);
        }
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

function classifyForDirection(
    options: PropertyFieldOption[],
    optionName: string,
    candidateName: string,
    direction: EdgeDirection,
): ParentCandidateClass {
    switch (direction) {
    case 'children':
        return classifyParentCandidate(options, candidateName, optionName);
    case 'parents':
        return classifyParentCandidate(options, optionName, candidateName);
    default: {
        const exhaustive: never = direction;
        return exhaustive;
    }
    }
}
