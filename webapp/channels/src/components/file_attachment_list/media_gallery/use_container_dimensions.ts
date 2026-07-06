// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import type {RefObject} from 'react';

export type ContainerDimensions = {
    width: number;
    height: number;
};

export function useContainerDimensions(ref: RefObject<HTMLElement>): ContainerDimensions {
    const [dimensions, setDimensions] = useState<ContainerDimensions>({width: 0, height: 0});

    useEffect(() => {
        const node = ref.current;
        if (!node) {
            return undefined;
        }

        const rect = node.getBoundingClientRect();
        setDimensions({width: rect.width, height: rect.height});

        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const nextWidth = entry.contentRect?.width ?? 0;
                const nextHeight = entry.contentRect?.height ?? 0;
                setDimensions((prev) => {
                    if (Math.abs(prev.width - nextWidth) < 1 && Math.abs(prev.height - nextHeight) < 1) {
                        return prev;
                    }
                    return {width: nextWidth, height: nextHeight};
                });
            }
        });
        observer.observe(node);

        return () => observer.disconnect();
    }, [ref]);

    return dimensions;
}
