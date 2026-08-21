// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {useEffect, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {useLatest} from 'hooks/useLatest';

import {proposeReplaceOccurrenceParent, type ConfirmGrant, type ProposeParentResult} from './graph_parent_ops';
import {wouldCreateCycle, wouldExceedMaxEdges} from './graph_utils';

export const GRAPH_ROW_DRAG_KIND = 'graph-row';

export type GraphRowDragData = {
    kind: typeof GRAPH_ROW_DRAG_KIND;
    optionName: string;
    parentName: string | null;
};

export function isGraphRowDragData(data: Record<string | symbol, unknown>): data is GraphRowDragData {
    return data.kind === GRAPH_ROW_DRAG_KIND &&
        typeof data.optionName === 'string' &&
        (data.parentName === null || typeof data.parentName === 'string');
}

export function isSameGraphOccurrence(a: GraphRowDragData, b: GraphRowDragData): boolean {
    return a.optionName === b.optionName && a.parentName === b.parentName;
}

/**
 * Root occurrence (oldParentName === null) gaining a parent is net-new.
 * Replacing one existing parent with another is not.
 * Already-listed newParent is not (G4 noOp).
 */
export function dropWouldAddNetNewEdge(
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
    if (oldParentName === null) {
        return true;
    }
    if (!parents.includes(oldParentName)) {
        return true;
    }
    return false;
}

/** Product legality: DropIndicator + propose. Spike `can_reparent`. */
export function canReparentGraphRow(
    source: GraphRowDragData,
    target: GraphRowDragData,
    options: PropertyFieldOption[],
): boolean {
    if (isSameGraphOccurrence(source, target)) {
        return false;
    }
    if (source.optionName === target.optionName) {
        return false;
    }
    if (wouldCreateCycle(options, source.optionName, target.optionName)) {
        return false;
    }
    return true;
}

/**
 * PDND canDrop for a flat sibling row.
 * Self/descendant are intentionally allowed through so onDrop can alert.
 * Net-new at max edges is blocked here (G16, no toast).
 */
export function canDropOnGraphRow(
    sourceData: Record<string | symbol, unknown>,
    target: GraphRowDragData,
    options: PropertyFieldOption[],
): boolean {
    if (!isGraphRowDragData(sourceData)) {
        return false;
    }
    if (isSameGraphOccurrence(sourceData, target)) {
        return false;
    }
    if (dropWouldAddNetNewEdge(options, sourceData.optionName, sourceData.parentName, target.optionName) &&
        wouldExceedMaxEdges(options)
    ) {
        return false;
    }
    return true;
}

export type UseGraphRowDndOptions = {
    rowElement: HTMLElement | null;
    handleElement: HTMLElement | null;
    optionName: string;
    parentName: string | null;
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    confirmGrant?: ConfirmGrant;
    disabled: boolean;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
};

export type UseGraphRowDndResult = {
    isOver: boolean;
};

export function useGraphRowDnd({
    rowElement,
    handleElement,
    optionName,
    parentName,
    options,
    onOptionsChange,
    confirmGrant,
    disabled,
    onDropResult,
}: UseGraphRowDndOptions): UseGraphRowDndResult {
    const [isOver, setIsOver] = useState(false);

    const optionsRef = useLatest(options);
    const onOptionsChangeRef = useLatest(onOptionsChange);
    const confirmGrantRef = useLatest(confirmGrant);
    const onDropResultRef = useLatest(onDropResult);

    useEffect(() => {
        if (!rowElement || !handleElement || disabled) {
            setIsOver(false);
            return undefined;
        }

        const target: GraphRowDragData = {
            kind: GRAPH_ROW_DRAG_KIND,
            optionName,
            parentName,
        };

        return combine(
            draggable({
                element: handleElement,
                canDrag: () => !disabled,
                getInitialData: (): GraphRowDragData => ({
                    kind: GRAPH_ROW_DRAG_KIND,
                    optionName,
                    parentName,
                }),
            }),
            dropTargetForElements({
                element: rowElement,
                canDrop: ({source}) => canDropOnGraphRow(source.data, target, optionsRef.current),
                getData: () => target,
                onDrag: ({source}) => {
                    if (!isGraphRowDragData(source.data)) {
                        setIsOver(false);
                        return;
                    }
                    setIsOver(canReparentGraphRow(source.data, target, optionsRef.current));
                },
                onDragLeave: () => setIsOver(false),
                onDrop: ({source}) => {
                    setIsOver(false);
                    void handleGraphRowDrop({
                        sourceData: source.data,
                        target,
                        options: optionsRef.current,
                        confirmGrant: confirmGrantRef.current,
                        onOptionsChange: onOptionsChangeRef.current,
                        onDropResult: onDropResultRef.current,
                    });
                },
            }),
        );

    // options / callbacks read via refs. Re-registering mid-drag tears down PDND.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowElement, handleElement, optionName, parentName, disabled]);

    return {isOver};
}

export async function handleGraphRowDrop(args: {
    sourceData: Record<string | symbol, unknown>;
    target: GraphRowDragData;
    options: PropertyFieldOption[];
    confirmGrant: ConfirmGrant | undefined;
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
}): Promise<void> {
    const {sourceData, target, options, confirmGrant, onOptionsChange, onDropResult} = args;
    if (!isGraphRowDragData(sourceData)) {
        return;
    }
    const names = {childName: sourceData.optionName, parentName: target.optionName};

    if (isSameGraphOccurrence(sourceData, target)) {
        return;
    }

    if (!canReparentGraphRow(sourceData, target, options)) {
        if (sourceData.optionName === target.optionName) {
            return;
        }
        onDropResult(
            {status: 'invalid', check: {ok: false, error: 'cycle'}},
            names,
        );
        return;
    }

    const result = await proposeReplaceOccurrenceParent(
        options,
        sourceData.optionName,
        sourceData.parentName,
        target.optionName,
        confirmGrant,
    );
    if (result.status === 'applied') {
        onOptionsChange(result.options);
    }
    onDropResult(result, names);
}
