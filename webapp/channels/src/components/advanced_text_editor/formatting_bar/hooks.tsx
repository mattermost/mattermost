// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import {debounce} from 'lodash';
import React, {useCallback, useEffect, useLayoutEffect, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

type WideMode = 'wide' | 'normal' | 'narrow' | 'min';

export function useGetLatest<T>(val: T) {
    const ref = React.useRef<T>(val);
    ref.current = val;
    return React.useCallback(() => ref.current, []);
}

const useResponsiveFormattingBar = (ref: React.RefObject<HTMLDivElement>): WideMode => {
    const [wideMode, setWideMode] = useState<WideMode>('wide');
    const handleResize = useCallback(debounce(() => {
        if (ref.current?.clientWidth === undefined) {
            return;
        }
        if (ref.current.clientWidth > 640) {
            setWideMode('wide');
        }
        if (ref.current.clientWidth >= 424 && ref.current.clientWidth <= 640) {
            setWideMode('normal');
        }
        if (ref.current.clientWidth < 424) {
            setWideMode('narrow');
        }

        if (ref.current.clientWidth < 310) {
            setWideMode('min');
        }
    }, 10), []);

    useLayoutEffect(() => {
        if (!ref.current) {
            return () => {};
        }

        let sizeObserver: ResizeObserver | null = new ResizeObserver(handleResize);

        sizeObserver.observe(ref.current);

        return () => {
            sizeObserver!.disconnect();
            sizeObserver = null;
        };
    }, [handleResize, ref]);

    return wideMode;
};

const MAP_WIDE_MODE_TO_CONTROLS_QUANTITY: {[key in WideMode]: number} = {
    wide: 9,
    normal: 5,
    narrow: 3,
    min: 1,
};

export const useFormattingBarControls = (
    formattingBarRef: React.RefObject<HTMLDivElement>,
): {
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    wideMode: WideMode;
} => {
    const wideMode = useResponsiveFormattingBar(formattingBarRef);

    const allControls: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

    const controlsLength = MAP_WIDE_MODE_TO_CONTROLS_QUANTITY[wideMode];

    const controls = allControls.slice(0, controlsLength);
    const hiddenControls = allControls.slice(controlsLength);

    return {
        controls,
        hiddenControls,
        wideMode,
    };
};

export const useUpdateOnVisibilityChange = (update: Instance['update'] | null, isVisible: boolean) => {
    const updateComponent = async () => {
        if (!update) {
            return;
        }
        await update();
    };

    useEffect(() => {
        if (!isVisible) {
            return;
        }
        updateComponent();
    }, [isVisible]);
};
