// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {getChildren, getRoots} from './graph_utils';

export type GraphOccurrence = {
    option: PropertyFieldOption;
    parentName: string | null;
    depth: number;
    path: string[];
    occurrenceKey: string;
};

export function flattenOccurrences(options: PropertyFieldOption[]): GraphOccurrence[] {
    const occurrences: GraphOccurrence[] = [];

    const walk = (option: PropertyFieldOption, path: string[]) => {
        occurrences.push({
            option,
            parentName: path.length === 1 ? null : path[path.length - 2],
            depth: path.length - 1,
            path,
            occurrenceKey: path.join('\0'),
        });
        for (const child of getChildren(options, option.name)) {
            if (path.includes(child.name)) {
                continue;
            }
            walk(child, [...path, child.name]);
        }
    };

    for (const root of getRoots(options)) {
        walk(root, [root.name]);
    }

    return occurrences;
}

export function pathStartsWith(path: string[], prefix: string[]): boolean {
    if (path.length < prefix.length) {
        return false;
    }
    return prefix.every((name, i) => path[i] === name);
}

export function isHiddenByCollapsedAncestor(path: string[], collapsedKeys: Set<string>): boolean {
    for (let i = 1; i < path.length; i++) {
        if (collapsedKeys.has(path.slice(0, i).join('\0'))) {
            return true;
        }
    }
    return false;
}

export function occurrenceHasChildren(options: PropertyFieldOption[], occurrence: GraphOccurrence): boolean {
    return getChildren(options, occurrence.option.name).some((child) => !occurrence.path.includes(child.name));
}

export function expandAncestorsForOption(
    collapsedKeys: Set<string>,
    occurrences: GraphOccurrence[],
    optionName: string,
): Set<string> {
    const target = occurrences.find((occurrence) => occurrence.option.name === optionName);
    if (!target || target.path.length < 2) {
        return collapsedKeys;
    }
    let changed = false;
    const next = new Set(collapsedKeys);
    for (let i = 1; i < target.path.length; i++) {
        if (next.delete(target.path.slice(0, i).join('\0'))) {
            changed = true;
        }
    }
    return changed ? next : collapsedKeys;
}

export function remapOccurrenceKey(key: string, oldName: string, newName: string): string {
    return key.split('\0').map((part) => (part === oldName ? newName : part)).join('\0');
}

export function subtreeInsertAfterIndex(occurrences: GraphOccurrence[], occurrence: GraphOccurrence, index: number): number {
    let insertAfterIndex = index;
    for (let j = index; j < occurrences.length; j++) {
        if (pathStartsWith(occurrences[j].path, occurrence.path)) {
            insertAfterIndex = j;
        } else if (j > index) {
            break;
        }
    }
    return insertAfterIndex;
}
