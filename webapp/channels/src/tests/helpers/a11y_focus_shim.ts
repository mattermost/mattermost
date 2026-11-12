// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {A11yCustomEventTypes} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';

// a11yFocus() only dispatches a custom event that A11yController handles in the
// running app. This mimics the controller's mouse path (`target.focus()`) so
// components that rely on a11yFocus for initial focus can be tested in jsdom.
const onA11yFocus = (e: Event) => {
    const detail = (e as CustomEvent<A11yFocusEventDetail>).detail;
    detail?.target?.focus();
};

/**
 * Makes a11yFocus() focus its target for the tests in the enclosing describe block.
 * Call it inside a describe, since it registers beforeAll and afterAll hooks.
 */
export function installA11yFocusShim() {
    beforeAll(() => document.addEventListener(A11yCustomEventTypes.FOCUS, onA11yFocus));
    afterAll(() => document.removeEventListener(A11yCustomEventTypes.FOCUS, onA11yFocus));
}
