// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {monitorForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type {Edge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {extractClosestEdge} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import {useEffect, useState} from 'react';

import {useLatest} from 'hooks/useLatest';

interface UseBookmarksDndOptions {
    order: string[]; // full bookmark order from Redux
    visibleItems: string[]; // items shown in bar
    onReorder: (id: string, prevIndex: number, nextIndex: number) => Promise<void>;
}

interface UseBookmarksDndResult {
    isDragging: boolean;
    activeId: string | null;
    forceOverflowOpen: boolean | undefined;
    setForceOverflowOpen: (open: boolean | undefined) => void;
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
    onReorder,
}: UseBookmarksDndOptions): UseBookmarksDndResult {
    const [activeId, setActiveId] = useState<string | null>(null);
    const isDragging = Boolean(activeId);
    const [forceOverflowOpen, setForceOverflowOpen] = useState<boolean | undefined>(undefined);

    // Use refs for order arrays so the monitor callback always sees current values
    // without needing to re-register on every order change
    const orderRef = useLatest(order);
    const visibleItemsRef = useLatest(visibleItems);
    const onReorderRef = useLatest(onReorder);

    useEffect(() => {
        return monitorForElements({
            canMonitor: ({source}) => source.data.type === 'bookmark',

            onDragStart: ({source}) => {
                setActiveId(source.data.bookmarkId as string);

                // If dragging from overflow, keep the menu force-open so MUI's
                // synchronous close during dragstart is overridden on next render.
                if (source.data.container === 'overflow') {
                    setForceOverflowOpen(true);
                }
            },

            onDrop: ({source, location}) => {
                setActiveId(null);

                const dropTarget = location.current.dropTargets[0];
                const hasOverflow = orderRef.current.length > visibleItemsRef.current.length;
                const droppedInOverflow =
                    dropTarget?.data.container === 'overflow' ||
                    (dropTarget?.data.type === 'overflow-trigger' && hasOverflow);
                setForceOverflowOpen(droppedInOverflow);

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
                    if (!hasOverflow) {
                        return;
                    }

                    // Dropped on the overflow trigger — place at the beginning of overflow
                    newIndex = visibleItemsRef.current.length;
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
                const target = location.current.dropTargets[0];
                const hasOverflow = orderRef.current.length > visibleItemsRef.current.length;
                if (target?.data.type === 'overflow-trigger' && hasOverflow) {
                    setForceOverflowOpen(true);
                }
            },
        });

    // Refs handle freshness; setForceOverflowOpen is a stable setState
    }, [setForceOverflowOpen]);

    return {
        isDragging,
        activeId,
        forceOverflowOpen,
        setForceOverflowOpen,
    };
}
