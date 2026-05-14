// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useLayoutEffect, useRef} from 'react';

type Snapshot = Map<Element, DOMRect>;

/**
 * FLIP animation helper. Call `snapshot()` immediately before a DOM-reordering
 * state update. On the next layout effect the hook reads new positions, computes
 * deltas, and plays a translate animation on each moved element.
 */
export function useFLIPAnimation(getElements: () => HTMLElement[]): {snapshot: () => void} {
    const pendingRef = useRef<Snapshot | null>(null);

    const snapshot = useCallback(() => {
        const map: Snapshot = new Map();
        for (const el of getElements()) {
            map.set(el, el.getBoundingClientRect());
        }
        pendingRef.current = map;
    }, [getElements]);

    // Runs after every render; only does real work when a snapshot is pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const pending = pendingRef.current;
        if (!pending) {
            return;
        }
        pendingRef.current = null;

        for (const [el, first] of pending) {
            const last = (el as HTMLElement).getBoundingClientRect();
            const dx = first.left - last.left;
            const dy = first.top - last.top;
            if (dx === 0 && dy === 0) {
                continue;
            }
            (el as HTMLElement).animate(
                [
                    {transform: `translate(${dx}px, ${dy}px)`},
                    {transform: 'translate(0, 0)'},
                ],
                {duration: 200, easing: 'ease-out'},
            );
        }
    });

    return {snapshot};
}
