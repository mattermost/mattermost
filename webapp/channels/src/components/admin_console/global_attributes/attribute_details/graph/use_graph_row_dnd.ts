// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {preserveOffsetOnSource} from '@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import {useEffect, useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {useLatest} from 'hooks/useLatest';

import {createGraphRowDragPreview, GRAPH_ROW_DRAG_PREVIEW_PAD_PX, graphRowDragDataAtPoint} from './drag_preview';
import {
    classifyGraphDrop,
    GRAPH_ROW_DRAG_KIND,
    isGraphRowDragData,
    type GraphRowDragData,
} from './drop_classifier';
import {proposeReplaceOccurrenceParent, type ConfirmGrant, type ProposeParentResult} from './parent_ops';

export type GraphDropAlert = {
    check: Extract<ProposeParentResult, {status: 'invalid'}>['check'];
    childName: string;
    parentName: string;
};

export function dropAlertFromProposeResult(
    result: ProposeParentResult,
    names: {childName: string; parentName: string},
): GraphDropAlert | null {
    switch (result.status) {
    case 'applied':
    case 'noOp':
    case 'cancelled':
    case 'fail-closed':
        return null;
    case 'invalid':
        if (result.check.error === 'self') {
            return null;
        }
        return {check: result.check, childName: names.childName, parentName: names.parentName};
    default: {
        const exhaustive: never = result;
        return exhaustive;
    }
    }
}

export async function applyGraphDrop(args: {
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
    const kind = classifyGraphDrop(sourceData, target, options);

    switch (kind) {
    case 'ignore':
    case 'blocked-max-edges':
        return;
    case 'alert-cycle':
        onDropResult({status: 'invalid', check: {ok: false, error: 'cycle'}}, names);
        return;
    case 'reparent': {
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
        return;
    }
    default: {
        const exhaustive: never = kind;
        throw new Error(exhaustive);
    }
    }
}

export async function alertOnMissedNativeGraphRowDrop(args: {
    sourceData: Record<string | symbol, unknown>;
    input: {clientX: number; clientY: number};
    options: PropertyFieldOption[];
    confirmGrant: ConfirmGrant | undefined;
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
}): Promise<void> {
    const target = graphRowDragDataAtPoint(args.input.clientX, args.input.clientY);
    if (!target) {
        return;
    }
    const kind = classifyGraphDrop(args.sourceData, target, args.options);
    switch (kind) {
    case 'reparent':
        // Honey-pot recovery is alert-only. A missed native drop must not
        // mutate. Legal reparents apply only through drop-target onDrop
        // → applyGraphDrop.
        return;
    case 'alert-cycle':
        await applyGraphDrop({
            sourceData: args.sourceData,
            target,
            options: args.options,
            confirmGrant: args.confirmGrant,
            onOptionsChange: args.onOptionsChange,
            onDropResult: args.onDropResult,
        });
        return;
    case 'ignore':
    case 'blocked-max-edges':
        return;
    default: {
        const exhaustive: never = kind;
        throw new Error(exhaustive);
    }
    }
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
                element: rowElement,
                dragHandle: handleElement,
                canDrag: () => !disabled,
                getInitialData: (): GraphRowDragData => ({
                    kind: GRAPH_ROW_DRAG_KIND,
                    optionName,
                    parentName,
                }),
                onGenerateDragPreview: ({nativeSetDragImage, location}) => {
                    const getSourceOffset = preserveOffsetOnSource({
                        element: rowElement,
                        input: location.current.input,
                    });
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        getOffset: ({container}) => {
                            const offset = getSourceOffset({container});
                            return {
                                x: offset.x + GRAPH_ROW_DRAG_PREVIEW_PAD_PX,
                                y: offset.y + GRAPH_ROW_DRAG_PREVIEW_PAD_PX,
                            };
                        },
                        render: ({container}) => {
                            container.appendChild(createGraphRowDragPreview(rowElement));
                        },
                    });
                },
                onDrop: ({source, location}) => {
                    if (location.current.dropTargets.length > 0) {
                        return;
                    }
                    alertOnMissedNativeGraphRowDrop({
                        sourceData: source.data,
                        input: location.current.input,
                        options: optionsRef.current,
                        confirmGrant: confirmGrantRef.current,
                        onOptionsChange: onOptionsChangeRef.current,
                        onDropResult: onDropResultRef.current,
                    }).catch(() => undefined);
                },
            }),
            dropTargetForElements({
                element: rowElement,
                canDrop: ({source}) => {
                    const kind = classifyGraphDrop(source.data, target, optionsRef.current);
                    switch (kind) {
                    case 'reparent':
                    case 'alert-cycle':
                        return true;
                    case 'blocked-max-edges':
                        return false;
                    case 'ignore':
                        return isGraphRowDragData(source.data) &&
                            source.data.optionName === target.optionName &&
                            source.data.parentName !== target.parentName;
                    default: {
                        const exhaustive: never = kind;
                        return exhaustive;
                    }
                    }
                },
                getData: () => target,
                onDrag: ({source}) => {
                    setIsOver(classifyGraphDrop(source.data, target, optionsRef.current) === 'reparent');
                },
                onDragLeave: () => setIsOver(false),
                onDrop: ({source}) => {
                    setIsOver(false);
                    applyGraphDrop({
                        sourceData: source.data,
                        target,
                        options: optionsRef.current,
                        confirmGrant: confirmGrantRef.current,
                        onOptionsChange: onOptionsChangeRef.current,
                        onDropResult: onDropResultRef.current,
                    }).catch(() => undefined);
                },
            }),
        );

    // options / callbacks read via refs. Re-registering mid-drag tears down PDND.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowElement, handleElement, optionName, parentName, disabled]);

    return {isOver};
}
