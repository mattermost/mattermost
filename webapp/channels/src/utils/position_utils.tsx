// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function popOverOverlayPosition(
    targetBounds: DOMRect,
    innerHeight: number,
    spaceRequiredAbove: number,
    spaceRequiredBelow?: number,
    horizontalPosition?: 'left' | 'right',
): string {
    let placement: string;

    if (targetBounds.top > spaceRequiredAbove) {
        placement = 'top';
    } else if (innerHeight - targetBounds.bottom > (spaceRequiredBelow || spaceRequiredAbove)) {
        placement = 'bottom';
    } else {
        placement = horizontalPosition || 'left';
    }
    return placement;
}

export function approxGroupPopOverHeight(
    groupListHeight: number,
    viewPortHeight: number,
    viewportScaleFactor: number,
    headerHeight: number,
    maxListHeight: number,
): number {
    return Math.min(
        (viewPortHeight * viewportScaleFactor) + headerHeight,
        groupListHeight + headerHeight,
        maxListHeight,
    );
}
