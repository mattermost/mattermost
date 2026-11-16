// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {OCCURRENCE_KEY_SEPARATOR} from 'components/property_fields/graph';
import type {GraphOccurrence} from 'components/property_fields/graph';

export function flattenOccurrenceTree(roots: GraphOccurrence[]): GraphOccurrence[] {
    const out: GraphOccurrence[] = [];
    const walk = (nodes: GraphOccurrence[]) => {
        for (const node of nodes) {
            out.push(node);
            walk(node.children);
        }
    };
    walk(roots);
    return out;
}

export function occurrencePath(occurrence: GraphOccurrence): string[] {
    return occurrence.key.split(OCCURRENCE_KEY_SEPARATOR);
}

export function pathStartsWith(path: string[], prefix: string[]): boolean {
    if (path.length < prefix.length) {
        return false;
    }
    return prefix.every((name, i) => path[i] === name);
}

export function isHiddenByCollapsedAncestor(path: string[], collapsedKeys: Set<string>): boolean {
    for (let i = 1; i < path.length; i++) {
        if (collapsedKeys.has(path.slice(0, i).join(OCCURRENCE_KEY_SEPARATOR))) {
            return true;
        }
    }
    return false;
}

export function occurrenceHasChildren(occurrence: GraphOccurrence): boolean {
    return occurrence.children.length > 0;
}

export function expandAncestorsForOption(
    collapsedKeys: Set<string>,
    occurrences: GraphOccurrence[],
    optionName: string,
): Set<string> {
    const target = occurrences.find((occurrence) => occurrence.option.name === optionName);
    if (!target) {
        return collapsedKeys;
    }
    const path = occurrencePath(target);
    if (path.length < 2) {
        return collapsedKeys;
    }
    let changed = false;
    const next = new Set(collapsedKeys);
    for (let i = 1; i < path.length; i++) {
        if (next.delete(path.slice(0, i).join(OCCURRENCE_KEY_SEPARATOR))) {
            changed = true;
        }
    }
    return changed ? next : collapsedKeys;
}

export function remapOccurrenceKey(key: string, oldName: string, newName: string): string {
    return key.split(OCCURRENCE_KEY_SEPARATOR).map((part) => (part === oldName ? newName : part)).join(OCCURRENCE_KEY_SEPARATOR);
}

export function subtreeInsertAfterIndex(
    occurrences: GraphOccurrence[],
    occurrence: GraphOccurrence,
    index: number,
): number {
    const prefix = occurrencePath(occurrence);
    let insertAfterIndex = index;
    for (let j = index; j < occurrences.length; j++) {
        if (pathStartsWith(occurrencePath(occurrences[j]), prefix)) {
            insertAfterIndex = j;
        } else if (j > index) {
            break;
        }
    }
    return insertAfterIndex;
}
