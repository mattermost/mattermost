// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {monitorForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useRef, useState} from 'react';

interface UseBookmarksDndOptions {
    order: string[]; // full bookmark order from Redux
    visibleItems: string[]; // items shown in bar
    overflowItems: string[]; // items in overflow menu
    onReorder: (id: string, prevIndex: number, nextIndex: number) => Promise<void>;
}

interface UseBookmarksDndResult {
    isDragging: boolean;
    activeId: string | null;
    autoOpenOverflow: boolean;
    setAutoOpenOverflow: (open: boolean) => void;
}

function getDropIndex(
    sourceIndex: number,
    targetIndex: number,
    edge: Edge | null,
): number {
    // When dropping on an edge, we want to insert before or after the target
    // Account for the source being removed from the list first

    if (edge === 'left' || edge === 'top') {
        // Insert before the target
        if (sourceIndex < targetIndex) {
            return targetIndex - 1;
        }
        return targetIndex;
    }

    // 'right' or 'bottom' — insert after the target
    if (sourceIndex < targetIndex) {
        return targetIndex;
    }
    return targetIndex + 1;
}

export function useBookmarksDnd({
    order,
    visibleItems,
    overflowItems,
    onReorder,
}: UseBookmarksDndOptions): UseBookmarksDndResult {
    const [isDragging, setIsDragging] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [autoOpenOverflow, setAutoOpenOverflow] = useState(false);

    // Use refs for order arrays so the monitor callback always sees current values
    // without needing to re-register on every order change
    const orderRef = useRef(order);
    const visibleItemsRef = useRef(visibleItems);
    const overflowItemsRef = useRef(overflowItems);
    const onReorderRef = useRef(onReorder);

    useEffect(() => {
        orderRef.current = order;
    }, [order]);
    useEffect(() => {
        visibleItemsRef.current = visibleItems;
    }, [visibleItems]);
    useEffect(() => {
        overflowItemsRef.current = overflowItems;
    }, [overflowItems]);
    useEffect(() => {
        onReorderRef.current = onReorder;
    }, [onReorder]);

    useEffect(() => {
        return monitorForElements({
            canMonitor: ({source}) => source.data.type === 'bookmark',

            onDragStart: ({source}) => {
                setIsDragging(true);
                setActiveId(source.data.bookmarkId as string);

                // If dragging from overflow, keep the menu force-open so MUI's
                // synchronous close during dragstart is overridden on next render.
                if (source.data.container === 'overflow') {
                    setAutoOpenOverflow(true);
                }
            },

            onDrop: ({source, location}) => {
                setIsDragging(false);
                setActiveId(null);

                // Don't reset autoOpenOverflow here — let the menu stay open
                // if it was opened during drag. User closes it normally.

                const sourceId = source.data.bookmarkId as string;
                const target = location.current.dropTargets[0];

                if (!target) {
                    // Dropped outside any target — cancel
                    return;
                }

                const currentOrder = orderRef.current;
                const oldIndex = currentOrder.indexOf(sourceId);
                if (oldIndex === -1) {
                    return;
                }

                let newIndex: number;

                if (target.data.type === 'overflow-trigger') {
                    // Dropped on the overflow trigger zone — append to end
                    newIndex = currentOrder.length - 1;
                } else if (target.data.type === 'bookmark') {
                    const targetId = target.data.bookmarkId as string;
                    const edge = extractClosestEdge(target.data);
                    const targetIndex = currentOrder.indexOf(targetId);

                    if (targetIndex === -1) {
                        return;
                    }

                    // Calculate insertion index based on edge
                    newIndex = getDropIndex(oldIndex, targetIndex, edge);
                } else {
                    return;
                }

                if (newIndex !== oldIndex) {
                    onReorderRef.current(sourceId, oldIndex, newIndex);
                }
            },

            onDropTargetChange: ({location}) => {
                // Detect when drag enters overflow-trigger zone
                const target = location.current.dropTargets[0];
                if (target?.data.type === 'overflow-trigger') {
                    setAutoOpenOverflow(true);
                }
            },
        });

    // Empty deps — refs handle freshness
    }, []);

    return {
        isDragging,
        activeId,
        autoOpenOverflow,
        setAutoOpenOverflow,
    };
}
