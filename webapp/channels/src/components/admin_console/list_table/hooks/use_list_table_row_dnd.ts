// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useState} from 'react';

import {useLatest} from 'hooks/useLatest';

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

// Wires PDND draggable + dropTarget onto a table row; returns the active drop edge.
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

    // Read via ref so the ghost reflects the row's latest name without re-registering.
    const getDragPreviewRef = useLatest(getDragPreview);

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
                    const previewEl = getDragPreviewRef.current?.();
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

    // getDragPreview read via ref (above); re-registering would tear down PDND state mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowElement, handleElement, enabled, dragKind, rowId, rowIndex]);

    return {closestEdge};
}
