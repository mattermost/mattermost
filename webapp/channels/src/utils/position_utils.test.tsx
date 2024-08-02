// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {popOverOverlayPosition, approxGroupPopOverHeight} from 'utils/position_utils';

test('Should return placement position for overlay based on bounds, space required and innerHeight', () => {
    const targetBounds = {
        top: 400,
        bottom: 500,
    };

    expect(popOverOverlayPosition(targetBounds as DOMRect, 1000, 300)).toEqual('top');
    expect(popOverOverlayPosition(targetBounds as DOMRect, 1000, 500, 300)).toEqual('bottom');
    expect(popOverOverlayPosition(targetBounds as DOMRect, 1000, 450)).toEqual('bottom');
    expect(popOverOverlayPosition(targetBounds as DOMRect, 1000, 600)).toEqual('left');
});

test('Should return the correct height for the group list overlay bounded by viewport height or max list height', () => {
    // constants. should not need to change
    const viewportScaleFactor = 0.4;
    const headerHeight = 130;
    const maxListHeight = 800;

    // array of [listHeight, viewPortHeight, expected]
    // tests for cases when
    // group list fits
    // group list is too tall for viewport
    // group list reaches max list height
    const testCases = [[100, 1000, 230], [500, 500, 330], [800, 2000, maxListHeight]];

    for (const [listHeight, viewPortHeight, expected] of testCases) {
        expect(
            approxGroupPopOverHeight(
                listHeight,
                viewPortHeight,
                viewportScaleFactor,
                headerHeight,
                maxListHeight,
            )).toBe(expected);
    }
});
