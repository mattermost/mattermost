// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DragEndEvent, DragOverEvent, DragStartEvent, UniqueIdentifier} from '@dnd-kit/core';
import {arrayMove} from '@dnd-kit/sortable';
import {useCallback, useRef, useState} from 'react';

export type ContainerId = 'bar' | 'overflow';

export interface DragState {
    activeId: UniqueIdentifier | null;
    activeContainer: ContainerId | null;
    overId: UniqueIdentifier | null;
    overContainer: ContainerId | null;
}

interface LocalOrder {
    visible: string[];
    overflow: string[];
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

const INITIAL_DRAG_STATE: DragState = {
    activeId: null,
    activeContainer: null,
    overId: null,
    overContainer: null,
};

/**
 * Hook to handle drag and drop logic for bookmarks,
 * including cross-list dragging between visible bar and overflow menu.
 */
export function useBookmarksDnd({
    visibleItems,
    overflowItems,
    onReorder,
}: UseBookmarksDndOptions): UseBookmarksDndResult {
    const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

    // Combined local order — single state object so updaters always see
    // the latest values for BOTH lists (no stale closure issues).
    const [localOrder, setLocalOrder] = useState<LocalOrder | null>(null);

    // Ref for activeContainer so handleDragOver reads it synchronously
    // without depending on dragState in its closure.
    const activeContainerRef = useRef<ContainerId | null>(null);

    const getContainer = useCallback((id: UniqueIdentifier): ContainerId | null => {
        const idStr = String(id);
        const visible = localOrder?.visible ?? visibleItems;
        const overflow = localOrder?.overflow ?? overflowItems;

        if (visible.includes(idStr)) {
            return 'bar';
        }
        if (overflow.includes(idStr)) {
            return 'overflow';
        }
        return null;
    }, [visibleItems, overflowItems, localOrder]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const container = getContainer(active.id);
        activeContainerRef.current = container;

        setDragState({
            activeId: active.id,
            activeContainer: container,
            overId: null,
            overContainer: null,
        });

        setLocalOrder({
            visible: [...visibleItems],
            overflow: [...overflowItems],
        });
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

        // Use the original container from drag start — NOT getContainer() which
        // reads from the mutating local lists and would flip after a cross-container
        // move, causing an infinite dragOver → setState → re-render → dragOver loop.
        const activeContainer = activeContainerRef.current;
        const overContainer = getContainer(over.id) ?? (over.id === 'overflow-drop-zone' ? 'overflow' : 'bar');

        setDragState((prev) => ({
            ...prev,
            overId: over.id,
            overContainer,
        }));

        // Cross-container move
        if (activeContainer !== overContainer && activeContainer && overContainer) {
            setLocalOrder((prev) => {
                if (!prev) {
                    return prev;
                }
                const {visible, overflow} = prev;

                if (activeContainer === 'bar' && overContainer === 'overflow') {
                    if (overflow.includes(activeId)) {
                        // Already moved — reposition within overflow
                        const oldIndex = overflow.indexOf(activeId);
                        const newIndex = overflow.indexOf(overId);
                        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                            return {...prev, overflow: arrayMove(overflow, oldIndex, newIndex)};
                        }
                        return prev;
                    }

                    // First move from bar to overflow
                    const newVisible = visible.filter((id) => id !== activeId);
                    const overIndex = overflow.indexOf(overId);
                    const newOverflow = [...overflow];
                    newOverflow.splice(overIndex >= 0 ? overIndex : newOverflow.length, 0, activeId);
                    return {visible: newVisible, overflow: newOverflow};
                } else if (activeContainer === 'overflow' && overContainer === 'bar') {
                    if (visible.includes(activeId)) {
                        // Already moved — reposition within bar
                        const oldIndex = visible.indexOf(activeId);
                        const newIndex = visible.indexOf(overId);
                        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                            return {...prev, visible: arrayMove(visible, oldIndex, newIndex)};
                        }
                        return prev;
                    }

                    // First move from overflow to bar
                    const newOverflow = overflow.filter((id) => id !== activeId);
                    const overIndex = visible.indexOf(overId);
                    const newVisible = [...visible];
                    newVisible.splice(overIndex >= 0 ? overIndex : newVisible.length, 0, activeId);
                    return {visible: newVisible, overflow: newOverflow};
                }
                return prev;
            });
        } else if (activeContainer === overContainer && overId !== activeId) {
            // Reordering within same container
            setLocalOrder((prev) => {
                if (!prev) {
                    return prev;
                }

                if (activeContainer === 'bar') {
                    const oldIndex = prev.visible.indexOf(activeId);
                    const newIndex = prev.visible.indexOf(overId);
                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                        return {...prev, visible: arrayMove(prev.visible, oldIndex, newIndex)};
                    }
                } else if (activeContainer === 'overflow') {
                    const oldIndex = prev.overflow.indexOf(activeId);
                    const newIndex = prev.overflow.indexOf(overId);
                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                        return {...prev, overflow: arrayMove(prev.overflow, oldIndex, newIndex)};
                    }
                }
                return prev;
            });
        }
    }, [getContainer]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const {active, over} = event;

        if (!over) {
            setDragState(INITIAL_DRAG_STATE);
            setLocalOrder(null);
            activeContainerRef.current = null;
            return;
        }

        const activeId = String(active.id);

        // Calculate the new index in the combined order
        const finalVisible = localOrder?.visible ?? visibleItems;
        const finalOverflow = localOrder?.overflow ?? overflowItems;
        const combinedOrder = [...finalVisible, ...finalOverflow];

        const newIndex = combinedOrder.indexOf(activeId);
        const originalCombined = [...visibleItems, ...overflowItems];
        const oldIndex = originalCombined.indexOf(activeId);

        if (newIndex !== -1 && oldIndex !== newIndex) {
            await onReorder(activeId, oldIndex, newIndex);
        }

        setDragState(INITIAL_DRAG_STATE);
        setLocalOrder(null);
        activeContainerRef.current = null;
    }, [visibleItems, overflowItems, localOrder, onReorder]);

    const handleDragCancel = useCallback(() => {
        setDragState(INITIAL_DRAG_STATE);
        setLocalOrder(null);
        activeContainerRef.current = null;
    }, []);

    const getLocalOrder = useCallback(() => ({
        visible: localOrder?.visible ?? visibleItems,
        overflow: localOrder?.overflow ?? overflowItems,
    }), [localOrder, visibleItems, overflowItems]);

    return {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        getLocalOrder,
    };
}
