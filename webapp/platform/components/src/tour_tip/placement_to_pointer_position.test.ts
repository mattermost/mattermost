// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {placementToPointerPosition} from './placement_to_pointer_position';

describe('placementToPointerPosition', () => {
    test('maps vertical placements to opposite pointer edges', () => {
        expect(placementToPointerPosition('top')).toBe('bottom-center');
        expect(placementToPointerPosition('top-start')).toBe('bottom-left');
        expect(placementToPointerPosition('top-end')).toBe('bottom-right');
        expect(placementToPointerPosition('bottom')).toBe('top-center');
        expect(placementToPointerPosition('bottom-start')).toBe('top-left');
        expect(placementToPointerPosition('bottom-end')).toBe('top-right');
    });

    test('maps horizontal placements to opposite pointer edges', () => {
        expect(placementToPointerPosition('left')).toBe('right-center');
        expect(placementToPointerPosition('right')).toBe('left-center');
        expect(placementToPointerPosition('right-start')).toBe('left-center');
    });
});
