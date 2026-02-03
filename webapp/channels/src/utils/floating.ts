// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {detectOverflow} from '@floating-ui/react';
import type {Boundary, MiddlewareState} from '@floating-ui/react-dom';

export type HorizontallyWithinOptions = {

    /**
     * An element or Rect that the floating element should be aligned with. Often, this will be the result of calling
     * document.getElementById with the ID of a parent element (like the post textbox for the emoji picker).
     *
     * See Floating UI's documentation on detectOverflow for more details.
     */
    boundary?: Boundary | null;
}

/**
 * horizontallyWithin is a middleware for useFloating which shifts the floating element left or right to try to keep
 * it within the horizontal boundaries of the given boundary element.
 *
 * If the floating element is wider than the boundary, it'll be positioned right aligned with the boundary.
 */
export function horizontallyWithin(options: HorizontallyWithinOptions = {}) {
    return ({
        name: 'horizontallyWithin',
        options,
        async fn(state: MiddlewareState) {
            const {boundary} = options;

            if (!boundary) {
                return {};
            }

            const overflow = await detectOverflow(state, {
                boundary,
            });

            if (overflow.right > 0) {
                // The floating element is overflowing on the right, so shift left
                return {
                    x: state.x - overflow.right,
                    y: state.y,
                };
            } else if (overflow.left > 0) {
                // The floating element is overflowing on the left, so shift right
                return {
                    x: state.x + overflow.left,
                    y: state.y,
                };
            }

            // The floating element is horizontally within the boundary, so do nothing
            return {};
        },
    });
}
