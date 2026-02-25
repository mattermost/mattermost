// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combine} from '@atlaskit/pragmatic-drag-and-drop/combine';
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {setCustomNativeDragPreview} from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
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
    getElement: () => HTMLElement | null;
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
    getElement,
}: UseBookmarkDragDropOptions): UseBookmarkDragDropResult {
    const [isDragSelf, setIsDragSelf] = useState(false);
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    useEffect(() => {
        const el = getElement();
        if (!el || !canReorder) {
            return undefined;
        }

        return combine(
            draggable({
                element: el,
                getInitialData: () => ({type: 'bookmark', bookmarkId: id, container}),
                onGenerateDragPreview: ({nativeSetDragImage}) => {
                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        render: ({container: previewContainer}) => {
                            previewContainer.appendChild(createBookmarkDragPreview(displayName));
                        },
                    });
                },
                onDragStart: () => setIsDragSelf(true),
                onDrop: () => setIsDragSelf(false),
            }),
            dropTargetForElements({
                element: el,
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
    }, [id, container, allowedEdges, displayName, canReorder, getElement]);

    return {isDragSelf, closestEdge};
}
