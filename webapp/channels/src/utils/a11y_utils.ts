// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import a11y from './a11y_controller_instance';
import type {A11yFocusEventDetail} from './constants';
import {A11yCustomEventTypes} from './constants';

/**
 * Dispatches an accessibility-focused custom event on the given DOM element,
 * ref, or string ID.
 *
 * - If a string is provided, it uses `document.getElementById(...)`.
 * - If a React ref is provided, it uses `ref.current`.
 * - If an HTMLElement is provided, it uses that element directly.
 *
 * @param elementOrId - The DOM element, a ref to it, or a string ID.
 * @param keyboardOnly - Whether this focus event is triggered by keyboard interaction. Defaults to `true`.
 * @param resetOriginElement - Whether the original element stored data in the a11y controller should be reseted.
 */
export function focusElement(
    elementOrId: HTMLElement | React.RefObject<HTMLElement> | string,
    keyboardOnly = true,
    resetOriginElement = false,
) {
    let target: HTMLElement | null = null;

    if (typeof elementOrId === 'string') {
        // It's an ID string
        target = document.getElementById(elementOrId);
    } else if (
        // It's a React ref object
        typeof elementOrId === 'object' &&
        'current' in elementOrId &&
        elementOrId.current instanceof HTMLElement
    ) {
        target = elementOrId.current;
    } else if (elementOrId instanceof HTMLElement) {
        // Direct HTMLElement
        target = elementOrId;
    }

    // Dispatch focus event if a valid DOM element is found.
    if (target) {
        setTimeout(() => {
            document.dispatchEvent(
                new CustomEvent<A11yFocusEventDetail>(A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target,
                        keyboardOnly,
                    },
                }),
            );

            if (resetOriginElement) {
                a11y.resetOriginElement();
            }
        }, 0);
    }
}
