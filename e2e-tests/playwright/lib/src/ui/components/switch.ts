// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

/**
 * Returns the `<label>` wrapping a Compass `Switch`'s input, which is what receives the click.
 *
 * The input itself is invisible and never the hit target, so acting on it fails Playwright's
 * actionability checks, and `force: true` skips the wait for the element to stop moving too: a
 * forced click on a switch inside an opening modal can land where the switch used to be.
 * `check()` and `uncheck()` on the label still read and verify the input's checked state.
 *
 * @param input - the switch's `role="switch"` input, e.g. located by its `data-testid`
 */
export function switchLabel(input: Locator): Locator {
    return input.locator('xpath=ancestor::label[1]');
}
