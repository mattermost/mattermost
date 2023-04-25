// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SidebarSize, SIDEBAR_SNAP_SIZE, SIDEBAR_SNAP_SPEED_LIMIT} from 'utils/constants';

export const isResizableSize = (size: SidebarSize) => size !== SidebarSize.SMALL;

export const isOverLimit = (newWidth: number, maxWidth: number, minWidth: number) => {
    return newWidth > maxWidth || newWidth < minWidth;
};

export const isSizeLessThanSnapSize = (size: number) => {
    return Math.abs(size) <= SIDEBAR_SNAP_SIZE;
};

export const isSnapableSpeed = (speed: number) => {
    return Math.abs(speed) <= SIDEBAR_SNAP_SPEED_LIMIT;
};

export const shouldSnapWhenSizeGrown = (newWidth: number, prevWidth: number, defaultWidth: number) => {
    const diff = defaultWidth - newWidth;
    const isGrowing = newWidth > prevWidth;

    return diff >= 0 && diff <= SIDEBAR_SNAP_SIZE && isGrowing;
};

export const shouldSnapWhenSizeShrunk = (newWidth: number, prevWidth: number, defaultWidth: number) => {
    const diff = newWidth - defaultWidth;
    const isShrinking = newWidth < prevWidth;

    return diff >= 0 && diff <= SIDEBAR_SNAP_SIZE && isShrinking;
};

export const shouldRhsOverlapChannelView = (size: SidebarSize) => size === SidebarSize.MEDIUM;

export const requestAnimationFrameForMouseMove = (callback: (e: MouseEvent) => void) => {
    let isTriggered = false;

    return (e: MouseEvent) => {
        e.preventDefault();

        if (isTriggered) {
            return;
        }

        isTriggered = true;

        requestAnimationFrame(() => {
            isTriggered = false;
            return callback(e);
        });
    };
};

export const preventAnimation = (elem: HTMLElement) => {
    elem.classList.add('resizeWrapper', 'prevent-animation');
};

export const restoreAnimation = (elem: HTMLElement) => {
    elem.classList.remove('resizeWrapper', 'prevent-animation');
};

export const setWidth = (elem: HTMLElement, width: number, unit: 'px' | '%' = 'px') => {
    elem.style.width = `${width}${unit}`;
};

export const resetStyle = (elem: HTMLElement) => {
    elem.removeAttribute('style');
};

export const toggleColResizeCursor = () => {
    document.body.classList.toggle('resized');
};
