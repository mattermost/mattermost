// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';
import {partitionAt} from 'utils/array';

// Space reserved for the +N affordance, so the last visible chip never has to be
// dropped after the count is already committed.
const OVERFLOW_CHIP_WIDTH = 34;

// Gap between chips, matching $chip-gap in channel_attribute_labels.scss.
const CHIP_GAP = 4;

const RECALC_DEBOUNCE_MS = 100;

/**
 * Splits chip ids into those that fit the measured container and those that
 * overflow.
 *
 * Measured rather than a fixed break count: the channel header is crowded and
 * appears at many widths — main view, RHS, calls, popouts — so a fixed count
 * would push the call and info controls around at narrow widths. Same container
 * width and same chips always yield the same split.
 *
 * The channel bookmarks bar solves this same problem in
 * components/channel_bookmarks/hooks/use_bookmarks_overflow.ts. Kept separate
 * because that one's reserved widths and pause-during-reorder behaviour are
 * specific to a draggable bar; if a third caller appears, extract the shared
 * accumulate-and-split core rather than growing either copy.
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

        // Nothing has been laid out yet. Show everything rather than bailing:
        // an unmeasured row must not stay collapsed, and because the row only
        // contains the chips it is allowed to show, bailing here deadlocks —
        // zero visible chips means zero width, which means no measurement, which
        // means the chips never come back.
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

            // Everything after this chip has to fit alongside a +N, so the
            // reserve only applies while chips remain.
            const isLast = i === currentIds.length - 1;
            const reserve = isLast ? 0 : OVERFLOW_CHIP_WIDTH + CHIP_GAP;

            if (usedWidth + chipWidth + reserve > availableWidth) {
                // Always show at least one chip: a header showing only "+3"
                // names no marking at all.
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

    // Show everything the moment the set changes, then measure and shrink.
    // Starting from "all visible" rather than the previous split matters on the
    // first load: labels arrive after mount, so a stale index from the empty set
    // would otherwise render a +N with no chips beside it.
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
