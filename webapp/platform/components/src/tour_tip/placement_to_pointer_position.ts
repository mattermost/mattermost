// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Placement} from '@floating-ui/react';

import type {TourPointPointerPosition} from '@mattermost/compass-ui/components/tour-point';

/**
 * Maps Floating UI resolved placement to Compass TourPoint pointer edge.
 * The pointer sits on the card edge opposite the anchor.
 */
export function placementToPointerPosition(placement: Placement): TourPointPointerPosition {
    const [side, alignment] = placement.split('-') as [string, 'start' | 'end' | undefined];

    switch (side) {
    case 'top':
        if (alignment === 'start') {
            return 'bottom-left';
        }
        if (alignment === 'end') {
            return 'bottom-right';
        }
        return 'bottom-center';
    case 'bottom':
        if (alignment === 'start') {
            return 'top-left';
        }
        if (alignment === 'end') {
            return 'top-right';
        }
        return 'top-center';
    case 'left':
        return 'right-center';
    case 'right':
        return 'left-center';
    default:
        return 'left-center';
    }
}
