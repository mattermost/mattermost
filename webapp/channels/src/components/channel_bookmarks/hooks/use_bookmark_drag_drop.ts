// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import {preventUnhandled} from '@atlaskit/pragmatic-drag-and-drop/prevent-unhandled';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {attachClosestEdge, extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useState} from 'react';

import {createBookmarkDragPreview} from '../drag_preview';

interface UseBookmarkDragDropOptions {
    id: string;
    container: 'bar' | 'overflow';
    allowedEdges: Edge[];
    displayName: string;
    canReorder: boolean;
    element: HTMLElement | null;
}

interface UseBookmarkDragDropResult {
    isDragSelf: boolean;
    closestEdge: Edge | null;
}

export function useBookmarkDragDrop({
    id,
    container,
    allowedEdges,
    displayName,
    canReorder,
    element,
}: UseBookmarkDragDropOptions): UseBookmarkDragDropResult {
    const [isDragSelf, setIsDragSelf] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        if (!element || !canReorder) {
            return undefined;
        }

        // Set effectAllowed to 'move' on the native DataTransfer during
        // dragstart. This constrains the browser to only show cursor:default
        // (move) instead of cursor:copy over non-drop-target areas.
        const handleDragStart = (e: DragEvent) => {
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
            }
        };
        element.addEventListener('dragstart', handleDragStart);

        const cleanup = combine(
            draggable({
                element,
                getInitialData: () => ({type: 'bookmark', bookmarkId: id, container}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container: previewContainer}) => {
                            previewContainer.appendChild(createBookmarkDragPreview(displayName));
                        },
                    });
                },
                onDragStart: () => {
                    setIsDragSelf(true);
                    preventUnhandled.start();
                },
                onDrop: () => {
                    setIsDragSelf(false);
                    preventUnhandled.stop();
                },
            }),
            dropTargetForElements({
                element,
                getData: ({input, element: targetElement}) =>
                    attachClosestEdge(
                        {type: 'bookmark', bookmarkId: id, container},
                        {input, element: targetElement, allowedEdges},
                    ),
                canDrop: ({source}) =>
                    source.data.type === 'bookmark' && source.data.bookmarkId !== id,
                onDrag: ({self}) => setClosestEdge(extractClosestEdge(self.data)),
                onDragLeave: () => setClosestEdge(null),
                onDrop: () => setClosestEdge(null),
            }),
        );

        return () => {
            element.removeEventListener('dragstart', handleDragStart);
            cleanup();
        };
    }, [id, container, allowedEdges, displayName, canReorder, element]);

    return {isDragSelf, closestEdge};
}
