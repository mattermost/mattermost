// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SidebarSize, SIDEBAR_SNAP_SIZE, SIDEBAR_SNAP_SPEED_LIMIT} from './constants';

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

