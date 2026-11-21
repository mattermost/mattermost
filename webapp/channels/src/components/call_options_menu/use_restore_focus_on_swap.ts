// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useLayoutEffect, useRef} from 'react';
import type {RefObject} from 'react';

/**
 * Moves focus to the button in the container when the button is swapped for another one while it, or the
 * menu it opened, had focus. Without this, focus falls back to the page when the focused button is removed.
 */
export default function useRestoreFocusOnSwap(containerRef: RefObject<HTMLElement | null>, menuId: string, swapKey: unknown) {
    const ownsFocus = useRef(false);

    useEffect(() => {
        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            ownsFocus.current = target instanceof Element && Boolean(containerRef.current?.contains(target) || target.closest(`#${menuId}`));
        };
        document.addEventListener('focusin', handleFocusIn);
        return () => document.removeEventListener('focusin', handleFocusIn);
    }, [containerRef, menuId]);

    const prevSwapKey = useRef(swapKey);
    useLayoutEffect(() => {
        if (prevSwapKey.current === swapKey) {
            return;
        }
        prevSwapKey.current = swapKey;

        const active = document.activeElement;
        if (ownsFocus.current && (!active || active === document.body)) {
            containerRef.current?.querySelector<HTMLElement>('button')?.focus();
        }
    }, [containerRef, swapKey]);
}
