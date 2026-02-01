// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DragEndEvent, DragOverEvent, DragStartEvent} from '@dnd-kit/core';
import {renderHook, act} from '@testing-library/react';

import {useBookmarksDnd} from './use_bookmarks_dnd';

describe('useBookmarksDnd', () => {
    const defaultProps = {
        visibleItems: ['1', '2', '3'],
        overflowItems: ['4', '5'],
        onReorder: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('initializes with null drag state', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        expect(result.current.dragState).toEqual({
            activeId: null,
            activeContainer: null,
            overId: null,
            overContainer: null,
        });
    });

    it('updates drag state on drag start', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        act(() => {
            result.current.handleDragStart({
                active: {id: '2', data: {current: {}}},
            } as DragStartEvent);
        });

        expect(result.current.dragState.activeId).toBe('2');
        expect(result.current.dragState.activeContainer).toBe('bar');
    });

    it('identifies container for overflow items', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        act(() => {
            result.current.handleDragStart({
                active: {id: '4', data: {current: {}}},
            } as DragStartEvent);
        });

        expect(result.current.dragState.activeId).toBe('4');
        expect(result.current.dragState.activeContainer).toBe('overflow');
    });

    it('updates over state on drag over', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        act(() => {
            result.current.handleDragOver({
                active: {id: '1', data: {current: {}}},
                over: {id: '3', data: {current: {}}},
            } as DragOverEvent);
        });

        expect(result.current.dragState.overId).toBe('3');
    });

    it('calls onReorder on drag end within same container', async () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() =>
            useBookmarksDnd({...defaultProps, onReorder}),
        );

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        act(() => {
            result.current.handleDragOver({
                active: {id: '1', data: {current: {}}},
                over: {id: '3', data: {current: {}}},
            } as DragOverEvent);
        });

        await act(async () => {
            await result.current.handleDragEnd({
                active: {id: '1', data: {current: {}}},
                over: {id: '3', data: {current: {}}},
            } as DragEndEvent);
        });

        expect(onReorder).toHaveBeenCalled();
    });

    it('resets drag state on drag cancel', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        expect(result.current.dragState.activeId).toBe('1');

        act(() => {
            result.current.handleDragCancel();
        });

        expect(result.current.dragState.activeId).toBeNull();
        expect(result.current.dragState.activeContainer).toBeNull();
    });

    it('resets drag state on drag end', async () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        await act(async () => {
            await result.current.handleDragEnd({
                active: {id: '1', data: {current: {}}},
                over: {id: '2', data: {current: {}}},
            } as DragEndEvent);
        });

        expect(result.current.dragState.activeId).toBeNull();
    });

    it('provides local order during drag', () => {
        const {result} = renderHook(() => useBookmarksDnd(defaultProps));

        // Before drag, should return original order
        let order = result.current.getLocalOrder();
        expect(order.visible).toEqual(['1', '2', '3']);
        expect(order.overflow).toEqual(['4', '5']);

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        // During drag, local order is initialized
        order = result.current.getLocalOrder();
        expect(order.visible).toEqual(['1', '2', '3']);
        expect(order.overflow).toEqual(['4', '5']);
    });

    it('does not call onReorder when dropped at same position', async () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() =>
            useBookmarksDnd({...defaultProps, onReorder}),
        );

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        // Dropped at the same position (item 1 -> still at index 0)
        await act(async () => {
            await result.current.handleDragEnd({
                active: {id: '1', data: {current: {}}},
                over: {id: '1', data: {current: {}}},
            } as DragEndEvent);
        });

        expect(onReorder).not.toHaveBeenCalled();
    });

    it('handles drag end with no over target', async () => {
        const onReorder = jest.fn().mockResolvedValue(undefined);
        const {result} = renderHook(() =>
            useBookmarksDnd({...defaultProps, onReorder}),
        );

        act(() => {
            result.current.handleDragStart({
                active: {id: '1', data: {current: {}}},
            } as DragStartEvent);
        });

        await act(async () => {
            await result.current.handleDragEnd({
                active: {id: '1', data: {current: {}}},
                over: null,
            } as unknown as DragEndEvent);
        });

        expect(onReorder).not.toHaveBeenCalled();
        expect(result.current.dragState.activeId).toBeNull();
    });
});
