// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';
import {partitionAt} from 'utils/array';

// Reserved for the +N affordance, so committing a count never forces a chip out.
const OVERFLOW_CHIP_WIDTH = 34;

// Gap between chips, matching $chip-gap in channel_attribute_labels.scss.
const CHIP_GAP = 4;

const RECALC_DEBOUNCE_MS = 100;

/**
 * Splits chip ids into those that fit the measured container and those that
 * overflow. Measured rather than a fixed break count: the header appears at many
 * widths, and a fixed count would push the call and info controls around.
 *
 * use_bookmarks_overflow.ts solves the same problem for a draggable bar. If a
 * third caller appears, extract the shared core rather than growing either copy.
 */
export function useLabelsOverflow(ids: string[]) {
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainerEl(node);
    }, []);

    const chipRefs = useRef<Map<string, HTMLElement>>(new Map());
    const observerRef = useRef<ResizeObserver | null>(null);

    const idsRef = useLatest(ids);
    const [overflowStartIndex, setOverflowStartIndex] = useState(ids.length);

    const calculateOverflow = useCallback(() => {
        const currentIds = idsRef.current;

        if (!containerEl || currentIds.length === 0) {
            setOverflowStartIndex(currentIds.length);
            return;
        }

        const availableWidth = containerEl.getBoundingClientRect().width;

        // Not laid out yet. Show everything rather than bailing: the row holds only
        // the chips it is allowed to show, so bailing deadlocks — no visible chips
        // means no width, means no measurement, means the chips never come back.
        if (availableWidth === 0) {
            setOverflowStartIndex(currentIds.length);
            return;
        }

        let usedWidth = 0;
        let nextIndex = currentIds.length;

        for (let i = 0; i < currentIds.length; i++) {
            const chipEl = chipRefs.current.get(currentIds[i]);
            if (!chipEl) {
                continue;
            }

            const chipWidth = chipEl.getBoundingClientRect().width + (i === 0 ? 0 : CHIP_GAP);

            // The reserve only applies while chips remain after this one.
            const isLast = i === currentIds.length - 1;
            const reserve = isLast ? 0 : OVERFLOW_CHIP_WIDTH + CHIP_GAP;

            if (usedWidth + chipWidth + reserve > availableWidth) {
                // At least one chip: a header showing only "+3" names no marking.
                nextIndex = Math.max(1, i);
                break;
            }

            usedWidth += chipWidth;
        }

        setOverflowStartIndex(nextIndex);
    }, [containerEl, idsRef]);

    const debouncedCalculateOverflow = useDebounce(calculateOverflow, RECALC_DEBOUNCE_MS);

    useEffect(() => {
        const observer = new ResizeObserver(debouncedCalculateOverflow);
        observerRef.current = observer;
        chipRefs.current.forEach((el) => observer.observe(el));

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [debouncedCalculateOverflow]);

    const registerChipRef = useCallback((id: string, element: HTMLElement | null) => {
        const existing = chipRefs.current.get(id);
        if (existing) {
            observerRef.current?.unobserve(existing);
        }
        if (element) {
            chipRefs.current.set(id, element);
            observerRef.current?.observe(element);
        } else {
            chipRefs.current.delete(id);
        }
    }, []);

    useEffect(() => {
        if (containerEl) {
            registerChipRef('__container', containerEl);
        }
        return () => registerChipRef('__container', null);
    }, [containerEl, registerChipRef]);

    // Show everything when the set changes, then measure and shrink. Labels arrive
    // after mount, so a stale index from the empty set would render a +N alone.
    useEffect(() => {
        setOverflowStartIndex(ids.length);
        debouncedCalculateOverflow();
        return () => debouncedCalculateOverflow.cancel();
    }, [ids, debouncedCalculateOverflow]);

    const [visibleIds, overflowIds] = useMemo(
        () => partitionAt(ids, overflowStartIndex),
        [ids, overflowStartIndex],
    );

    return {containerRef, registerChipRef, visibleIds, overflowIds};
}
