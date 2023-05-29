// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

export const useFollowElementDimensions = (elementId: string): DOMRectReadOnly => {
    const [dimensions, setDimensions] = useState(new DOMRect());

    useEffect(() => {
        const element = document.getElementById(elementId);
        if (!element) {
            return undefined;
        }
        const observer = new ResizeObserver((entries) => {
            if (entries.length > 0) {
                setDimensions(entries[0].contentRect);
            }
        });
        observer.observe(element);

        return () => {
            observer.unobserve(element);
        };
    }, [elementId]);

    return dimensions;
};
