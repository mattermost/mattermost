// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useLayoutEffect, useRef} from 'react';

export type FLIPOptions = {
    items: string[];
    getElement: (id: string) => HTMLElement | null;

    /**
     * Resolve the DOM node(s) that should receive the translate animation
     * for a given measured element. Defaults to animating the measured
     * element itself.
     *
     * This exists because `transform` on `<tr>` (display: table-row) is
     * spec-undefined and Chromium/Firefox effectively ignore it. For table
     * rows pass a resolver that returns the row's `<td>` cells instead.
     */
    getAnimationTargets?: (measured: HTMLElement) => HTMLElement[];

    duration?: number;
};

/**
 * Declarative FLIP animation hook. Tracks positions of `items` after every
 * commit and, when the order of `items` changes between commits, animates
 * each element from its previous position to its new position.
 *
 * Decoupled from when state actually commits — the trigger is the order-key
 * change between renders, not an imperative `snapshot()` call. This works
 * correctly when reorder dispatches through async middleware (Redux thunks,
 * etc.) since the "before" positions are taken from whatever the most recent
 * committed render was, not from when the dispatch happened.
 */
export function useFLIPAnimation({
    items,
    getElement,
    getAnimationTargets,
    duration = 200,
}: FLIPOptions): void {
    const prevPositionsRef = useRef<Map<string, DOMRect> | null>(null);
    const prevOrderKeyRef = useRef<string | null>(null);

    const getElementRef = useRef(getElement);
    getElementRef.current = getElement;
    const getAnimationTargetsRef = useRef(getAnimationTargets);
    getAnimationTargetsRef.current = getAnimationTargets;

    const orderKey = items.join('|');

    // No deps array on purpose: we want this to run after *every* commit so
    // we always have fresh "before" positions to compare against on the next
    // reorder. `items` is read inside (the lint-required dep) but we'd be
    // re-running on every render anyway, so the dep array adds noise without
    // changing behavior. Closures over `getElement` / `getAnimationTargets`
    // are kept fresh via refs to avoid spurious re-registrations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const newPositions = new Map<string, DOMRect>();
        for (const id of items) {
            const el = getElementRef.current(id);
            if (el && el.isConnected) {
                newPositions.set(id, el.getBoundingClientRect());
            }
        }

        const prev = prevPositionsRef.current;
        const prevKey = prevOrderKeyRef.current;
        const orderChanged = prev !== null && prevKey !== null && prevKey !== orderKey;

        if (orderChanged) {
            const resolveTargets = getAnimationTargetsRef.current;

            for (const [id, oldRect] of prev) {
                const newRect = newPositions.get(id);
                if (!newRect) {
                    continue;
                }
                const dx = oldRect.left - newRect.left;
                const dy = oldRect.top - newRect.top;
                if (dx === 0 && dy === 0) {
                    continue;
                }

                const el = getElementRef.current(id);
                if (!el || !el.isConnected) {
                    continue;
                }

                const targets = resolveTargets ? resolveTargets(el) : [el];
                for (const target of targets) {
                    target.animate(
                        [
                            {transform: `translate(${dx}px, ${dy}px)`},
                            {transform: 'translate(0, 0)'},
                        ],
                        {duration, easing: 'ease-out'},
                    );
                }
            }
        }

        prevPositionsRef.current = newPositions;
        prevOrderKeyRef.current = orderKey;
    });
}
