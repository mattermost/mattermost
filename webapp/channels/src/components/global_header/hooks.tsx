// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import type {MutableRefObject} from 'react';

/**
 * Hook that alerts clicks outside of the passed ref.
 */
export function useClickOutsideRef(ref: MutableRefObject<HTMLElement | null>, handler: () => void): void {
    useEffect(() => {
        function onMouseDown(event: MouseEvent) {
            const target = event.target as any;
            if (ref.current && target instanceof Node && !ref.current.contains(target)) {
                handler();
            }
        }

        // Bind the event listener
        document.addEventListener('mousedown', onMouseDown);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener('mousedown', onMouseDown);
        };
    }, [ref, handler]);
}
