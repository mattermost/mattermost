// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {popOverOverlayPosition} from 'utils/position_utils';

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
