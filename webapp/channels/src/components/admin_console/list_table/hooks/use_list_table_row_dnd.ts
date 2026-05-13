// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useState} from 'react';

type UseListTableRowDndOptions = {
    dragKind: string;
    rowId: string;
    rowIndex: number;
    rowElement: HTMLElement | null;
    handleElement: HTMLElement | null;
    enabled: boolean;
    getDragPreview?: () => HTMLElement | undefined;
};

type UseListTableRowDndResult = {
    closestEdge: Edge | null;
};

/**
 * Wires PDND draggable + dropTarget onto a single table row element.
 * Returns the closest edge during an active drag so the caller can render a DropIndicator.
 */
export function useListTableRowDnd({
    dragKind,
    rowId,
    rowIndex,
    rowElement,
    handleElement,
    enabled,
    getDragPreview,
}: UseListTableRowDndOptions): UseListTableRowDndResult {
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        if (!rowElement || !enabled) {
            return undefined;
        }

        return combine(
            draggable({
                element: rowElement,
                dragHandle: handleElement ?? undefined,
                getInitialData: () => ({kind: dragKind, rowId, rowIndex}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    const previewEl = getDragPreview?.();
                    if (!previewEl) {
                        return;
                    }
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container}) => {
                            container.appendChild(previewEl);
                        },
                    });
                },
            }),
            dropTargetForElements({
                element: rowElement,
                canDrop: ({source}) =>
                    source.data.kind === dragKind &&
                    source.data.rowId !== rowId,
                getData: ({input, element}) =>
                    attachClosestEdge(
                        {kind: dragKind, rowId, rowIndex},
                        {input, element, allowedEdges: ['top', 'bottom']},
                    ),
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );
    }, [rowElement, handleElement, enabled, dragKind, rowId, rowIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    return {closestEdge};
}
