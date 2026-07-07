// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MutableRefObject} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';
import {partitionAt} from 'utils/array';

// Space to reserve for the menu button
const MENU_BUTTON_WIDTH = 80;

// Inline padding on the bar container
const BAR_INLINE_PADDING = 16;

// Gap between bookmark items
const ITEM_GAP = 4;

// Debounce delay for overflow recalculation
const OVERFLOW_DEBOUNCE_MS = 100;

interface UseObservedRefsOptions {
    onResize: () => void;
    refs: MutableRefObject<Map<string, HTMLElement>>;
}

/**
 * Adds resize observation to a keyed element registry. Watches every
 * registered element via a single shared ResizeObserver and fires
 * `onResize` when any element's dimensions change (e.g. after a rename).
 *
 * Returns a stable `register` callback — call with the element on mount
 * and `null` on unmount.
 */
function useObservedRefs({onResize, refs}: UseObservedRefsOptions) {
    const observerRef = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver(onResize);
        observerRef.current = observer;

        // Observe any elements registered before the observer was created
        refs.current.forEach((el) => observer.observe(el));

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [onResize]);

    const register = useCallback((id: string, element: HTMLElement | null) => {
        const existing = refs.current.get(id);
        if (existing) {
            observerRef.current?.unobserve(existing);
        }
        if (element) {
            refs.current.set(id, element);
            observerRef.current?.observe(element);
        } else {
            refs.current.delete(id);
        }
    }, []);

    return {register};
}

export function useBookmarksOverflow(order: string[]) {
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainerEl(node);
    }, []);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const isPausedRef = useRef(false);
    const pendingRecalcRef = useRef(false);

    const orderRef = useLatest(order);

    const [overflowStartIndex, setOverflowStartIndex] = useState<number>(order.length);

    const calculateOverflow = useCallback(() => {
        if (isPausedRef.current) {
            pendingRecalcRef.current = true;
            return;
        }

        const currentOrder = orderRef.current;
        if (!containerEl || currentOrder.length === 0) {
            setOverflowStartIndex(currentOrder.length);
            return;
        }

        const containerWidth = containerEl.getBoundingClientRect().width;
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
    }, [containerEl, orderRef, itemRefs]);

    const debouncedCalculateOverflow = useDebounce(calculateOverflow, OVERFLOW_DEBOUNCE_MS);

    // Single shared ResizeObserver for items and container. Item width
    // changes (e.g. rename) and container resizes (viewport/sidebar)
    // both trigger overflow recalculation.
    const {register: registerItemRef} = useObservedRefs({
        onResize: debouncedCalculateOverflow,
        refs: itemRefs,
    });

    // Register/unregister the container element. containerEl is state
    // (from callback ref) so this re-runs when the element mounts.
    useEffect(() => {
        if (containerEl) {
            registerItemRef('__container', containerEl);
        }
        return () => registerItemRef('__container', null);
    }, [containerEl, registerItemRef]);

    // Recalculate on order changes and initial mount.
    // During active reorder this is blocked by isPausedRef; the pending
    // recalc fires when the pause releases.
    useEffect(() => {
        debouncedCalculateOverflow();
        return () => debouncedCalculateOverflow.cancel();
    }, [order, debouncedCalculateOverflow]);

    const [visibleItems, overflowItems] = useMemo(() => partitionAt(order, overflowStartIndex), [order, overflowStartIndex]);

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
