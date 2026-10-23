// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

/**
 * Returns the `<label>` wrapping a Compass `Switch`'s input, which is what receives the click.
 *
 * The input itself is invisible and never the hit target, so acting on it fails Playwright's
 * actionability checks, and `force: true` skips the wait for the element to stop moving too: a
 * forced click on a switch inside an opening modal can land where the switch used to be.
 * `check()` and `uncheck()` on the label still read and verify the input's checked state.
 *
 * @param scope - the page or container the switch is in
 * @param input - the input's `data-testid`, or a page-rooted locator for it (e.g. `page.getByRole('switch')`),
 *   since it is matched inside the label rather than from `scope`
 */
export function switchLabel(scope: Page | Locator, input: string | Locator): Locator {
    const page = 'page' in scope ? scope.page() : scope;
    const inputLocator = typeof input === 'string' ? page.getByTestId(input) : input;
    return scope.locator('label').filter({has: inputLocator});
}
