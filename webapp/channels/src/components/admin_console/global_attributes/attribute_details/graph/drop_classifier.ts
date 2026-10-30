// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {wouldCreateCycle, wouldExceedMaxEdges} from './graph_utils';

export const GRAPH_ROW_DRAG_KIND = 'graph-row';

export type GraphRowDragData = {
    kind: typeof GRAPH_ROW_DRAG_KIND;
    optionName: string;
    parentName: string | null;
};

export type GraphDropKind = 'ignore' | 'reparent' | 'alert-cycle' | 'blocked-max-edges';

export function isGraphRowDragData(data: Record<string | symbol, unknown>): data is GraphRowDragData {
    return data.kind === GRAPH_ROW_DRAG_KIND &&
        typeof data.optionName === 'string' &&
        (data.parentName === null || typeof data.parentName === 'string');
}

function isSameGraphOccurrence(a: GraphRowDragData, b: GraphRowDragData): boolean {
    return a.optionName === b.optionName && a.parentName === b.parentName;
}

function dropWouldAddNetNewEdge(
    options: PropertyFieldOption[],
    childName: string,
    oldParentName: string | null,
    newParentName: string,
): boolean {
    const child = options.find((option) => option.name === childName);
    const parents = child?.parents ?? [];
    if (parents.includes(newParentName)) {
        return false;
    }
    return oldParentName === null || !parents.includes(oldParentName);
}

export function classifyGraphDrop(
    source: Record<string | symbol, unknown>,
    target: GraphRowDragData,
    options: PropertyFieldOption[],
): GraphDropKind {
    if (!isGraphRowDragData(source)) {
        return 'ignore';
    }
    if (isSameGraphOccurrence(source, target)) {
        return 'ignore';
    }
    if (
        dropWouldAddNetNewEdge(options, source.optionName, source.parentName, target.optionName) &&
        wouldExceedMaxEdges(options)
    ) {
        return 'blocked-max-edges';
    }
    if (source.optionName === target.optionName) {
        return 'ignore';
    }
    if (wouldCreateCycle(options, source.optionName, target.optionName)) {
        return 'alert-cycle';
    }
    return 'reparent';
}
