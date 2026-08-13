// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Instance} from '@popperjs/core';
import debounce from 'lodash/debounce';
import {useEffect, useLayoutEffect, useMemo, useState} from 'react';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

export const LayoutModes = {
    Wide: 'wide',
    Normal: 'normal',
    Narrow: 'narrow',
    Min: 'min',
} as const;

type LayoutMode = typeof LayoutModes[keyof typeof LayoutModes];

type Threshold = [minWidth: number, mode: LayoutMode];

// Ordered descending — first match (width >= threshold) wins, fallback is 'min'.
const THRESHOLDS_CENTER: Threshold[] = [
    [641, LayoutModes.Wide],
    [424, LayoutModes.Normal],
    [310, LayoutModes.Narrow],
];

const THRESHOLDS_RHS: Threshold[] = [
    [620, LayoutModes.Wide],
    [460, LayoutModes.Normal],
    [340, LayoutModes.Narrow],
];

const DEBOUNCE_DELAY = 10;

function resolveLayoutMode(width: number, thresholds: Threshold[]): LayoutMode {
    for (const [minWidth, mode] of thresholds) {
        if (width >= minWidth) {
            return mode;
        }
    }
    return LayoutModes.Min;
}

function isRHSLocation(location: string): boolean {
    return location.toLowerCase().includes('rhs');
}

const useResponsiveFormattingBar = (element: HTMLDivElement | null, isRHS: boolean): LayoutMode => {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutModes.Wide);

    const handleResize = useMemo(() => debounce(() => {
        if (!element) {
            return;
        }
        const thresholds = isRHS ? THRESHOLDS_RHS : THRESHOLDS_CENTER;
        setLayoutMode(resolveLayoutMode(element.clientWidth, thresholds));
    }, DEBOUNCE_DELAY), [element, isRHS]);

    useLayoutEffect(() => {
        if (!element) {
            return () => {};
        }

        const sizeObserver = new ResizeObserver(handleResize);
        sizeObserver.observe(element);

        return () => {
            handleResize.cancel();
            sizeObserver.disconnect();
        };
    }, [handleResize, element]);

    return layoutMode;
};

// Base icon counts for each mode (no additional controls)
const CONTROLS_COUNT_BASE: Record<LayoutMode, number> = {
    [LayoutModes.Wide]: 9,
    [LayoutModes.Normal]: 5,
    [LayoutModes.Narrow]: 2,
    [LayoutModes.Min]: 1,
};

// All available formatting controls in priority order
const ALL_CONTROLS: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

// Wide layout always shows all icons — there is enough room regardless of additional controls.
// Center channel: reduction starts from the 2nd additional control (1 extra always fits).
// RHS: reduction starts from the 1st additional control (tighter space).
function getVisibleControlsCount(layoutMode: LayoutMode, additionalControlsCount: number, isRHS: boolean): number {
    const base = CONTROLS_COUNT_BASE[layoutMode];
    if (layoutMode === LayoutModes.Wide) {
        return base;
    }
    const reduction = isRHS ? additionalControlsCount : Math.max(0, additionalControlsCount - 1);
    return Math.max(0, base - reduction);
}

function canFitTextStyleDropdown(layoutMode: LayoutMode): boolean {
    return layoutMode === LayoutModes.Wide || layoutMode === LayoutModes.Normal;
}

export function splitFormattingBarControls(
    layoutMode: LayoutMode,
    additionalControlsCount: number = 0,
    isRHS: boolean = false,
    hasTextStyleDropdown: boolean = false,
) {
    const showTextStyleDropdown = hasTextStyleDropdown && canFitTextStyleDropdown(layoutMode);

    let visibleControlsCount = getVisibleControlsCount(layoutMode, additionalControlsCount, isRHS);

    if (showTextStyleDropdown && layoutMode !== LayoutModes.Wide) {
        visibleControlsCount = Math.max(0, visibleControlsCount - 3);
    }

    const sourceControls = showTextStyleDropdown ? ALL_CONTROLS.filter((c) => c !== 'heading') : ALL_CONTROLS;

    const controls = sourceControls.slice(0, visibleControlsCount);
    const hiddenControls = sourceControls.slice(visibleControlsCount);

    return {
        controls,
        hiddenControls,
        showTextStyleDropdown,
    };
}

export const useFormattingBarControls = (
    additionalControlsCount: number = 0,
    location: string = '',
    hasTextStyleDropdown: boolean = false,
): {
    formattingBarRef: (node: HTMLDivElement | null) => void;
    controls: MarkdownMode[];
    hiddenControls: MarkdownMode[];
    layoutMode: LayoutMode;
    showTextStyleDropdown: boolean;
} => {
    const [element, setElement] = useState<HTMLDivElement | null>(null);

    const isRHS = useMemo(() => isRHSLocation(location), [location]);
    const layoutMode = useResponsiveFormattingBar(element, isRHS);

    const {controls, hiddenControls, showTextStyleDropdown} = useMemo(() => {
        return splitFormattingBarControls(layoutMode, additionalControlsCount, isRHS, hasTextStyleDropdown);
    }, [layoutMode, additionalControlsCount, isRHS, hasTextStyleDropdown]);

    return {
        formattingBarRef: setElement,
        controls,
        hiddenControls,
        layoutMode,
        showTextStyleDropdown,
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
