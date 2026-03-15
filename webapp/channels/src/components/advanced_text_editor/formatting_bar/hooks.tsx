// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import debounce from 'lodash/debounce';
import type React from 'react';
import {useEffect, useLayoutEffect, useMemo, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

type WideMode = 'wide' | 'normal' | 'narrow' | 'min';

type Threshold = [minWidth: number, mode: WideMode];

// Ordered descending — first match (width >= threshold) wins, fallback is 'min'.
const THRESHOLDS_CENTER: Threshold[] = [
    [641, 'wide'],
    [424, 'normal'],
    [310, 'narrow'],
];

const THRESHOLDS_RHS: Threshold[] = [
    [521, 'wide'],
    [380, 'normal'],
    [280, 'narrow'],
];

const DEBOUNCE_DELAY = 10;

function resolveWideMode(width: number, thresholds: Threshold[]): WideMode {
    for (const [minWidth, mode] of thresholds) {
        if (width >= minWidth) {
            return mode;
        }
    }
    return 'min';
}

function isRHSLocation(location: string): boolean {
    return location.toLowerCase().includes('rhs');
}

const useResponsiveFormattingBar = (ref: React.RefObject<HTMLDivElement>, isRHS: boolean): WideMode => {
    const [wideMode, setWideMode] = useState<WideMode>('wide');

    const thresholds = isRHS ? THRESHOLDS_RHS : THRESHOLDS_CENTER;

    const handleResize = useMemo(() => debounce(() => {
        if (!ref.current) {
            return;
        }
        setWideMode(resolveWideMode(ref.current.clientWidth, thresholds));
    }, DEBOUNCE_DELAY), [ref, thresholds]);

    useLayoutEffect(() => {
        if (!ref.current) {
            return () => {};
        }

        const sizeObserver = new ResizeObserver(handleResize);
        sizeObserver.observe(ref.current);

        return () => {
            handleResize.cancel();
            sizeObserver.disconnect();
        };
    }, [handleResize, ref]);

    return wideMode;
};

// Base icon counts for each mode (no additional controls)
const CONTROLS_COUNT_BASE: Record<WideMode, number> = {
    wide: 9,
    normal: 5,
    narrow: 3,
    min: 1,
};

// Reduced icon counts when additional controls are present (to prevent overlap)
const CONTROLS_COUNT_WITH_ADDITIONAL: Record<WideMode, number> = {
    wide: 7,
    normal: 3,
    narrow: 1,
    min: 0,
};

// Minimum number of additional controls needed to trigger reduction in narrow mode for center channel
const NARROW_MODE_MIN_ADDITIONAL_CONTROLS = 2;

// All available formatting controls in priority order
const ALL_CONTROLS: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

export function splitFormattingBarControls(wideMode: WideMode, additionalControlsCount: number = 0, isRHS: boolean = false) {
    let visibleControlsCount = CONTROLS_COUNT_BASE[wideMode];

    if (additionalControlsCount > 0) {
        if (isRHS) {
            visibleControlsCount = CONTROLS_COUNT_WITH_ADDITIONAL[wideMode];
        } else if (wideMode === 'narrow' && additionalControlsCount < NARROW_MODE_MIN_ADDITIONAL_CONTROLS) {
            visibleControlsCount = CONTROLS_COUNT_BASE.narrow;
        } else {
            visibleControlsCount = CONTROLS_COUNT_WITH_ADDITIONAL[wideMode];
        }
    }

    const controls = ALL_CONTROLS.slice(0, visibleControlsCount);
    const hiddenControls = ALL_CONTROLS.slice(visibleControlsCount);

    return {
        controls,
        hiddenControls,
    };
}

export const useFormattingBarControls = (
    formattingBarRef: React.RefObject<HTMLDivElement>,
    additionalControlsCount: number = 0,
    location: string = '',
): {
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    wideMode: WideMode;
} => {
    const isRHS = useMemo(() => isRHSLocation(location), [location]);
    const wideMode = useResponsiveFormattingBar(formattingBarRef, isRHS);

    const {controls, hiddenControls} = useMemo(() => {
        return splitFormattingBarControls(wideMode, additionalControlsCount, isRHS);
    }, [wideMode, additionalControlsCount, isRHS]);

    return {
        controls,
        hiddenControls,
        wideMode,
    };
};

export const useUpdateOnVisibilityChange = (update: Instance['update'] | null, isVisible: boolean) => {
    useEffect(() => {
        if (!isVisible || !update) {
            return;
        }
        update();
    }, [isVisible, update]);
};
