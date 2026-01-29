// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';
import {useCallback, useState} from 'react';

export type ContainerId = 'bar' | 'overflow';

export interface DragState {
    activeId: UniqueIdentifier | null;
    activeContainer: ContainerId | null;
    overId: UniqueIdentifier | null;
    overContainer: ContainerId | null;
}

interface UseBookmarksDndOptions {
    visibleItems: string[];
    overflowItems: string[];
    onReorder: (id: string, prevIndex: number, nextIndex: number) => Promise<void>;
}

interface UseBookmarksDndResult {
    dragState: DragState;
    handleDragStart: (event: DragStartEvent) => void;
    handleDragOver: (event: DragOverEvent) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    handleDragCancel: () => void;
    getLocalOrder: () => {visible: string[]; overflow: string[]};
}

/**
 * Hook to handle drag and drop logic for bookmarks,
 * including cross-list dragging between visible bar and overflow menu.
 */
export function useBookmarksDnd({
    visibleItems,
    overflowItems,
    onReorder,
}: UseBookmarksDndOptions): UseBookmarksDndResult {
    const [dragState, setDragState] = useState<DragState>({
        activeId: null,
        activeContainer: null,
        overId: null,
        overContainer: null,
    });

    // Local order during drag (for optimistic UI)
    const [localVisible, setLocalVisible] = useState<string[] | null>(null);
    const [localOverflow, setLocalOverflow] = useState<string[] | null>(null);

    const getContainer = useCallback((id: UniqueIdentifier): ContainerId | null => {
        const idStr = String(id);
        const visible = localVisible ?? visibleItems;
        const overflow = localOverflow ?? overflowItems;

        if (visible.includes(idStr)) {
            return 'bar';
        }
        if (overflow.includes(idStr)) {
            return 'overflow';
        }
        return null;
    }, [visibleItems, overflowItems, localVisible, localOverflow]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const container = getContainer(active.id);

        setDragState({
            activeId: active.id,
            activeContainer: container,
            overId: null,
            overContainer: null,
        });

        // Initialize local order
        setLocalVisible([...visibleItems]);
        setLocalOverflow([...overflowItems]);
    }, [visibleItems, overflowItems, getContainer]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const {active, over} = event;

        if (!over) {
            setDragState((prev) => ({
                ...prev,
                overId: null,
                overContainer: null,
            }));
            return;
        }

        const activeId = String(active.id);
        const overId = String(over.id);
        const activeContainer = getContainer(active.id);
        const overContainer = getContainer(over.id) ?? (over.id === 'overflow-droppable' ? 'overflow' : 'bar');

        setDragState((prev) => ({
            ...prev,
            overId: over.id,
            overContainer,
        }));

        // If moving between containers, update local order
        if (activeContainer !== overContainer && activeContainer && overContainer) {
            setLocalVisible((prev) => {
                const visible = prev ?? visibleItems;
                const overflow = localOverflow ?? overflowItems;

                if (activeContainer === 'bar' && overContainer === 'overflow') {
                    // Moving from bar to overflow
                    const newVisible = visible.filter((id) => id !== activeId);
                    const overIndex = overflow.indexOf(overId);
                    const newOverflow = [...overflow];
                    newOverflow.splice(overIndex >= 0 ? overIndex : newOverflow.length, 0, activeId);
                    setLocalOverflow(newOverflow);
                    return newVisible;
                } else if (activeContainer === 'overflow' && overContainer === 'bar') {
                    // Moving from overflow to bar
                    const newOverflow = overflow.filter((id) => id !== activeId);
                    const overIndex = visible.indexOf(overId);
                    const newVisible = [...visible];
                    newVisible.splice(overIndex >= 0 ? overIndex : newVisible.length, 0, activeId);
                    setLocalOverflow(newOverflow);
                    return newVisible;
                }
                return prev;
            });
        } else if (activeContainer === overContainer && overId !== activeId) {
            // Reordering within same container
            if (activeContainer === 'bar') {
                setLocalVisible((prev) => {
                    const visible = prev ?? visibleItems;
                    const oldIndex = visible.indexOf(activeId);
                    const newIndex = visible.indexOf(overId);
                    if (oldIndex !== -1 && newIndex !== -1) {
                        return arrayMove(visible, oldIndex, newIndex);
                    }
                    return prev;
                });
            } else if (activeContainer === 'overflow') {
                setLocalOverflow((prev) => {
                    const overflow = prev ?? overflowItems;
                    const oldIndex = overflow.indexOf(activeId);
                    const newIndex = overflow.indexOf(overId);
                    if (oldIndex !== -1 && newIndex !== -1) {
                        return arrayMove(overflow, oldIndex, newIndex);
                    }
                    return prev;
                });
            }
        }
    }, [visibleItems, overflowItems, localOverflow, getContainer]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const {active, over} = event;

        if (!over) {
            // Cancelled or no drop target
            setDragState({
                activeId: null,
                activeContainer: null,
                overId: null,
                overContainer: null,
            });
            setLocalVisible(null);
            setLocalOverflow(null);
            return;
        }

        const activeId = String(active.id);

        // Calculate the new index in the combined order
        // The overflow items come after visible items
        const finalVisible = localVisible ?? visibleItems;
        const finalOverflow = localOverflow ?? overflowItems;
        const combinedOrder = [...finalVisible, ...finalOverflow];

        const newIndex = combinedOrder.indexOf(activeId);
        const originalCombined = [...visibleItems, ...overflowItems];
        const oldIndex = originalCombined.indexOf(activeId);

        if (newIndex !== -1 && oldIndex !== newIndex) {
            // Reorder API call
            await onReorder(activeId, oldIndex, newIndex);
        }

        // Reset state
        setDragState({
            activeId: null,
            activeContainer: null,
            overId: null,
            overContainer: null,
        });
        setLocalVisible(null);
        setLocalOverflow(null);
    }, [visibleItems, overflowItems, localVisible, localOverflow, onReorder]);

    const handleDragCancel = useCallback(() => {
        setDragState({
            activeId: null,
            activeContainer: null,
            overId: null,
            overContainer: null,
        });
        setLocalVisible(null);
        setLocalOverflow(null);
    }, []);

    const getLocalOrder = useCallback(() => ({
        visible: localVisible ?? visibleItems,
        overflow: localOverflow ?? overflowItems,
    }), [localVisible, localOverflow, visibleItems, overflowItems]);

    return {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        getLocalOrder,
    };
}
