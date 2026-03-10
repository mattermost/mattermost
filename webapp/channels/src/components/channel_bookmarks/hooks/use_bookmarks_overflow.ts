// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

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
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

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
        const container = containerRef.current;
        if (!container || order.length === 0) {
            setOverflowStartIndex(order.length);
            return;
        }

        const containerWidth = container.getBoundingClientRect().width;
        const availableWidth = containerWidth - MENU_BUTTON_WIDTH - BAR_INLINE_PADDING;

        let usedWidth = 0;
        let newOverflowIndex = order.length;

        for (let i = 0; i < order.length; i++) {
            const itemEl = itemRefs.current.get(order[i]);
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
    }, [order]);

    const debouncedCalculateOverflow = useCallback(() => {
        if (isPausedRef.current) {
            pendingRecalcRef.current = true;
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(calculateOverflow, OVERFLOW_DEBOUNCE_MS);
    }, [calculateOverflow]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        const timeoutId = setTimeout(calculateOverflow, 0);

        const resizeObserver = new ResizeObserver(() => {
            debouncedCalculateOverflow();
        });
        resizeObserver.observe(container);

        return () => {
            clearTimeout(timeoutId);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            resizeObserver.disconnect();
        };
    }, [calculateOverflow, debouncedCalculateOverflow, order]);

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
