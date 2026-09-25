// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';
import {partitionAt} from 'utils/array';

// Reserved for the +N affordance. Measured against the outer container, which holds
// both the chip row and the button, so the reserve and the width agree.
const OVERFLOW_CHIP_WIDTH = 42;

// Gap between chips, matching $chip-gap in channel_attribute_labels.scss.
const CHIP_GAP = 4;

// Keep in sync with min-width on .channel-header__description in _headers.scss.
const DESCRIPTION_MIN_WIDTH = 100;

const TITLE_SELECTOR = '.channel-header__title';
const DESCRIPTION_SELECTOR = 'channel-header__description';

const RECALC_DEBOUNCE_MS = 100;

function outerWidth(element: Element): number {
    const style = window.getComputedStyle(element);
    return element.getBoundingClientRect().width +
        (parseFloat(style.marginLeft) || 0) +
        (parseFloat(style.marginRight) || 0);
}

/**
 * Width the chips may occupy. In the channel header this is the title row minus
 * the channel name, the icon buttons, and a 100px floor for the header text —
 * not the icons cluster's current width, which is content-sized and would
 * collapse the chips permanently once they overflowed.
 */
function availableWidthForLabels(containerEl: HTMLElement): number {
    const title = containerEl.closest(TITLE_SELECTOR);
    if (title) {
        let used = 0;
        for (const child of Array.from(title.children)) {
            if (child.contains(containerEl)) {
                used += outerWidth(child) - child.getBoundingClientRect().width;
                for (const iconChild of Array.from(child.children)) {
                    if (iconChild !== containerEl) {
                        used += outerWidth(iconChild) + CHIP_GAP;
                    }
                }
            } else if (child.classList.contains(DESCRIPTION_SELECTOR)) {
                used += DESCRIPTION_MIN_WIDTH;
            } else {
                used += outerWidth(child);
            }
        }
        return title.getBoundingClientRect().width - used;
    }

    const parent = containerEl.parentElement;
    if (!parent) {
        return 0;
    }
    let siblingWidth = 0;
    for (const child of Array.from(parent.children)) {
        if (child === containerEl) {
            continue;
        }

        // Thread header: the channel name ellipsizes so +N never disappears.
        // Subtracting its current width would leave the chips nothing, then
        // clip the overflow chip itself.
        if (child.classList.contains('sidebar--right__title__channel')) {
            continue;
        }

        siblingWidth += child.getBoundingClientRect().width + CHIP_GAP;
    }

    // Padding is inside the parent's border box but outside the chips. Counting
    // it as available width would keep extra chips on the row until they wrap.
    const style = window.getComputedStyle(parent);
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    return parent.getBoundingClientRect().width - padding - siblingWidth;
}

/**
 * Splits chip ids into those that fit the measured container and those that
 * overflow. Measured rather than a fixed break count: the header appears at many
 * widths, and a fixed count would push the call and info controls around.
 *
 * use_bookmarks_overflow.ts solves the same problem for a draggable bar. If a
 * third caller appears, extract the shared core rather than growing either copy.
 */
type OverflowOptions = {

    // Channel header always keeps one chip so the row is not just "+3". The
    // thread header is tight enough that a forced chip becomes a colour square;
    // there, overflow may include every chip.
    allowEmptyVisible?: boolean;
};

export function useLabelsOverflow(ids: string[], {allowEmptyVisible = false}: OverflowOptions = {}) {
    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
    const containerRef = useCallback((node: HTMLDivElement | null) => {
        setContainerEl(node);
    }, []);

    const chipRefs = useRef<Map<string, HTMLElement>>(new Map());

    // Last measured content width per chip id. Populated when a chip is in the
    // DOM; retained after unmount so overflow chips can still be measured in
    // calculateOverflow without oscillating between "all fit" (no DOM → width 0)
    // and "some overflow" (DOM present → real width).
    const chipWidthCache = useRef<Map<string, number>>(new Map());

    const overflowElRef = useRef<HTMLElement | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const idsRef = useLatest(ids);
    const allowEmptyVisibleRef = useLatest(allowEmptyVisible);
    const [overflowStartIndex, setOverflowStartIndex] = useState(ids.length);

    // False until calculateOverflow has run at least once with real measurements.
    // The caller can use this to hide the container until the correct split is
    // known, avoiding a flash where all chips are briefly visible before collapsing.
    const [measured, setMeasured] = useState(false);

    const calculateOverflow = useCallback(() => {
        const currentIds = idsRef.current;

        if (!containerEl || currentIds.length === 0) {
            setOverflowStartIndex(currentIds.length);
            return;
        }

        const availableWidth = availableWidthForLabels(containerEl);

        // Not laid out yet. Show everything rather than bailing: the row holds only
        // the chips it is allowed to show, so bailing deadlocks — no visible chips
        // means no width, means no measurement, means the chips never come back.
        if (availableWidth <= 0) {
            setOverflowStartIndex(currentIds.length);
            return;
        }

        let usedWidth = 0;
        let nextIndex = currentIds.length;

        for (let i = 0; i < currentIds.length; i++) {
            const chipEl = chipRefs.current.get(currentIds[i]);

            // Use live width when the chip is in the DOM; fall back to the cached
            // width from the last time it was visible. If a chip has never been
            // measured, wait — collapsing it would hide it, so it would never
            // get a width, and the row would stay on +N even after space opens.
            let contentWidth: number;
            if (chipEl) {
                // scrollWidth is the unconstrained chip, even when the last visible
                // one is ellipsizing. Measuring the shrunk box would make more
                // chips look like they fit, then hide them, then fit, forever.
                contentWidth = Math.max(chipEl.getBoundingClientRect().width, chipEl.scrollWidth);
                if (contentWidth <= 0) {
                    return;
                }
                chipWidthCache.current.set(currentIds[i], contentWidth);
            } else {
                const cached = chipWidthCache.current.get(currentIds[i]);
                if (cached === undefined) {
                    return;
                }
                contentWidth = cached;
            }

            const chipWidth = contentWidth + (i === 0 ? 0 : CHIP_GAP);

            // Measured from the rendered button where there is one: a constant that
            // undershoots its real width clips the last chip by the difference.
            const overflowWidth = overflowElRef.current?.getBoundingClientRect().width || OVERFLOW_CHIP_WIDTH;

            // The reserve only applies while chips remain after this one.
            const isLast = i === currentIds.length - 1;
            const reserve = isLast ? 0 : overflowWidth + CHIP_GAP;

            if (usedWidth + chipWidth + reserve > availableWidth) {
                nextIndex = allowEmptyVisibleRef.current ? i : Math.max(1, i);
                break;
            }

            usedWidth += chipWidth;
        }

        setOverflowStartIndex(nextIndex);
        setMeasured(true);
    }, [containerEl, idsRef, allowEmptyVisibleRef]);

    const debouncedCalculateOverflow = useDebounce(calculateOverflow, RECALC_DEBOUNCE_MS);

    useEffect(() => {
        const observer = new ResizeObserver(debouncedCalculateOverflow);
        observerRef.current = observer;
        chipRefs.current.forEach((el) => observer.observe(el));
        const title = containerEl?.closest(TITLE_SELECTOR);
        const parent = containerEl?.parentElement;
        if (title) {
            observer.observe(title);
        }
        if (parent && parent !== title) {
            observer.observe(parent);
        }

        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [debouncedCalculateOverflow, containerEl]);

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

            // Width cache is intentionally kept — see chipWidthCache comment above.
        }
    }, []);

    useEffect(() => {
        if (containerEl) {
            registerChipRef('__container', containerEl);
        }
        return () => registerChipRef('__container', null);
    }, [containerEl, registerChipRef]);

    // Keyed on the chips themselves, not the array holding them: callers rebuild
    // that array on every value change and every graph name that resolves, and
    // re-hiding the row for each one blanked every chip while one was edited.
    const idsKey = ids.join('\0');

    // Show everything when the set changes, then measure and shrink. Labels arrive
    // after mount, so a stale index from the empty set would render a +N alone.
    // Drop cache entries for IDs that are no longer in the set — a new chip that
    // happens to reuse an old ID should be measured fresh, not sized by stale data.
    useEffect(() => {
        const live = new Set(ids);
        for (const id of chipWidthCache.current.keys()) {
            if (!live.has(id)) {
                chipWidthCache.current.delete(id);
            }
        }
        setMeasured(false);
        setOverflowStartIndex(ids.length);
        debouncedCalculateOverflow();
        return () => debouncedCalculateOverflow.cancel();

        // idsKey stands in for ids so a new array identity does not retrigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, debouncedCalculateOverflow]);

    const [visibleIds, overflowIds] = useMemo(
        () => partitionAt(ids, overflowStartIndex),
        [ids, overflowStartIndex],
    );

    const overflowRef = useCallback((element: HTMLElement | null) => {
        overflowElRef.current = element;
    }, []);

    return {containerRef, registerChipRef, overflowRef, visibleIds, overflowIds, measured};
}
