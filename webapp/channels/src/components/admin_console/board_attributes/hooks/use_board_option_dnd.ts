// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useState} from 'react';

type UseBoardOptionDndOptions = {
    fieldId: string;
    optionKey: string;
    chipElement: HTMLElement | null;
    dropZoneElement: HTMLElement | null;
    getDragPreview: () => HTMLElement;
};

type UseBoardOptionDndResult = {
    closestEdge: Edge | null;
};

/**
 * Wires PDND draggable + dropTarget for a single board option chip.
 * The chip element is the drag source; the drop zone element (which may have
 * extended padding) is the drop target. Returns closestEdge for DropIndicator.
 */
export function useBoardOptionDnd({
    fieldId,
    optionKey,
    chipElement,
    dropZoneElement,
    getDragPreview,
}: UseBoardOptionDndOptions): UseBoardOptionDndResult {
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        if (!chipElement || !dropZoneElement) {
            return undefined;
        }
        const dragKind = `board-option-chip:${fieldId}`;

        return combine(
            draggable({
                element: chipElement,
                getInitialData: () => ({kind: dragKind, optionKey}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container}) => {
                            container.appendChild(getDragPreview());
                        },
                    });
                },
            }),
            dropTargetForElements({
                element: dropZoneElement,
                canDrop: ({source}) =>
                    source.data.kind === dragKind &&
                    source.data.optionKey !== optionKey,
                getData: ({input, element}) =>
                    attachClosestEdge(
                        {kind: dragKind, optionKey},
                        {input, element, allowedEdges: ['left', 'right']},
                    ),
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );
    }, [chipElement, dropZoneElement, fieldId, optionKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return {closestEdge};
}
