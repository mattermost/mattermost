// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';

// Space to reserve for the menu button
const MENU_BUTTON_WIDTH = 80;

// Inline padding on the bar container
const BAR_INLINE_PADDING = 16;

// Gap between bookmark items
const ITEM_GAP = 4;

// Debounce delay for overflow recalculation
const OVERFLOW_DEBOUNCE_MS = 100;

export function useBookmarksOverflow(order: string[]) {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const isPausedRef = useRef(false);
    const pendingRecalcRef = useRef(false);

    const orderRef = useLatest(order);

    const [overflowStartIndex, setOverflowStartIndex] = useState<number>(order.length);

    const registerItemRef = useCallback((id: string, element: HTMLElement | null) => {
        if (element) {
            itemRefs.current.set(id, element);
        } else {
            itemRefs.current.delete(id);
        }
    }, []);

    const calculateOverflow = useCallback(() => {
        if (isPausedRef.current) {
            pendingRecalcRef.current = true;
            return;
        }

        const currentOrder = orderRef.current;
        const container = containerRef.current;
        if (!container || currentOrder.length === 0) {
            setOverflowStartIndex(currentOrder.length);
            return;
        }

        const containerWidth = container.getBoundingClientRect().width;
        const availableWidth = containerWidth - MENU_BUTTON_WIDTH - BAR_INLINE_PADDING;

        let usedWidth = 0;
        let newOverflowIndex = currentOrder.length;

        for (let i = 0; i < currentOrder.length; i++) {
            const itemEl = itemRefs.current.get(currentOrder[i]);
            if (!itemEl) {
                continue;
            }

            const itemWidth = itemEl.getBoundingClientRect().width + ITEM_GAP;
            if (usedWidth + itemWidth > availableWidth) {
                newOverflowIndex = Math.max(1, i); // Always show at least 1
                break;
            }
            usedWidth += itemWidth;
        }

        setOverflowStartIndex(newOverflowIndex);
    }, [orderRef]);

    const debouncedCalculateOverflow = useDebounce(calculateOverflow, OVERFLOW_DEBOUNCE_MS);

    // Set up ResizeObserver and trigger recalculation on order changes.
    // calculateOverflow and debouncedCalculateOverflow are stable (read
    // order from ref), so the observer is only recreated when order.length
    // changes (items added/removed, not reordered).
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        const resizeObserver = new ResizeObserver(() => {
            debouncedCalculateOverflow();
        });
        resizeObserver.observe(container);

        // Initial/re-calculation (debounced to ensure child refs are registered)
        debouncedCalculateOverflow();

        return () => {
            debouncedCalculateOverflow.cancel();
            resizeObserver.disconnect();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- order.length triggers recalc when items are added/removed
    }, [calculateOverflow, debouncedCalculateOverflow, order.length]);

    // Recalculate when order changes (reorder, add, remove).
    // During active reorder this is blocked by isPausedRef; the pending
    // recalc fires when the pause releases.
    useEffect(() => {
        debouncedCalculateOverflow();
    }, [order, debouncedCalculateOverflow]);

    const visibleItems = useMemo(() => order.slice(0, overflowStartIndex), [order, overflowStartIndex]);
    const overflowItems = useMemo(() => order.slice(overflowStartIndex), [order, overflowStartIndex]);

    const pauseRecalc = useCallback((paused: boolean) => {
        isPausedRef.current = paused;
        if (!paused && pendingRecalcRef.current) {
            pendingRecalcRef.current = false;
            calculateOverflow();
        }
    }, [calculateOverflow]);

    return {
        containerRef,
        registerItemRef,
        overflowStartIndex,
        visibleItems,
        overflowItems,
        pauseRecalc,
    };
}
