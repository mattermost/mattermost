// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useState} from 'react';

/**
 * Detects whether a text element is overflowing its container (e.g. truncated
 * with ellipsis). Returns `[isOverflowing, nodeRef]` — pass `nodeRef` as the
 * element's `ref` prop. Uses a callback ref so the observer re-binds when the
 * element identity changes (React refs don't trigger effect re-runs).
 *
 * Uses ResizeObserver to re-check on size changes.
 */
export function useTextOverflow(): [boolean, (node: HTMLElement | null) => void] {
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [node, setNode] = useState<HTMLElement | null>(null);
    const nodeRef = useCallback((el: HTMLElement | null) => {
        setNode(el);
    }, []);

    useEffect(() => {
        if (!node) {
            return undefined;
        }

        const checkOverflow = () => {
            setIsOverflowing(node.scrollWidth > node.clientWidth);
        };

        checkOverflow();

        const resizeObserver = new ResizeObserver(checkOverflow);
        resizeObserver.observe(node);

        return () => {
            resizeObserver.unobserve(node);
            resizeObserver.disconnect();
        };
    }, [node]);

    return [isOverflowing, nodeRef];
}
