// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MutableRefObject} from 'react';
import {useEffect} from 'react';

import {useLatest} from './useLatest';

/**
 * Fires `handler` on mousedown outside the element referenced by `ref`.
 * When `ref` is null, fires on any mousedown (click-anywhere).
 * When `enabled` is false, no listener is attached.
 *
 * The handler is accessed via useLatest ref so the listener is stable
 * and doesn't re-register when the handler identity changes.
 */
export function useClickOutside(
    ref: MutableRefObject<HTMLElement | null> | null,
    handler: () => void,
    enabled = true,
): void {
    const handlerRef = useLatest(handler);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        function onMouseDown(event: MouseEvent) {
            if (!ref) {
                handlerRef.current();
                return;
            }
            const target = event.target;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handlerRef.current();
            }
        }

        document.addEventListener('mousedown', onMouseDown);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handlerRef, enabled]);
}
