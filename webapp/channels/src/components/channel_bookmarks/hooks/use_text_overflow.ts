// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MutableRefObject} from 'react';
import {useEffect, useState} from 'react';

/**
 * Detects whether a text element is overflowing its container (e.g. truncated
 * with ellipsis). Returns true when scrollWidth > clientWidth.
 *
 * Uses ResizeObserver to re-check on size changes.
 */
export function useTextOverflow(ref: MutableRefObject<HTMLElement | null>) {
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const checkOverflow = () => {
            if (ref.current) {
                setIsOverflowing(ref.current.scrollWidth > ref.current.clientWidth);
            }
        };

        checkOverflow();

        const resizeObserver = new ResizeObserver(checkOverflow);
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [ref]);

    return isOverflowing;
}
