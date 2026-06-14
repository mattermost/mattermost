// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import type {RefObject} from 'react';

export function useContainerWidth(ref: RefObject<HTMLElement>): number {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) {
            return undefined;
        }

        setWidth(node.getBoundingClientRect().width);

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const next = entry.contentRect?.width ?? 0;
                setWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
            }
        });
        observer.observe(node);

        return () => observer.disconnect();
    }, [ref]);

    return width;
}
