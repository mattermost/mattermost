// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MutableRefObject} from 'react';
import {useEffect} from 'react';

/**
 * Fires `handler` on mousedown outside the element referenced by `ref`.
 * When `ref` is null, fires on any mousedown (click-anywhere).
 * When `enabled` is false, no listener is attached.
 */
export function useClickOutside(
    ref: MutableRefObject<HTMLElement | null> | null,
    handler: () => void,
    enabled = true,
): void {
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        function onMouseDown(event: MouseEvent) {
            if (!ref) {
                handler();
                return;
            }
            const target = event.target;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handler();
            }
        }

        document.addEventListener('mousedown', onMouseDown);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handler, enabled]);
}
