// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

/**
 * A Compass `Switch`. Interactions go through its `<label>`, which is what receives the click.
 *
 * The input itself is invisible and never the hit target, so acting on it fails Playwright's
 * actionability checks, and `force: true` skips the wait for the element to stop moving too: a
 * forced click on a switch inside an opening modal can land where the switch used to be.
 * `check()` and `uncheck()` on the label still read and verify the input's checked state.
 */
export default class Switch {
    readonly input: Locator;
    readonly label: Locator;

    /**
     * @param container - the element the switch is in
     * @param testId - the input's `data-testid`; omit when `container` holds a single switch
     */
    constructor(container: Locator, testId?: string) {
        const page = container.page();
        this.input = testId ? container.getByTestId(testId) : container.getByRole('switch');

        // `has` is matched inside each label, so it takes a page-rooted locator.
        this.label = container
            .locator('label')
            .filter({has: testId ? page.getByTestId(testId) : page.getByRole('switch')});
    }

    isChecked() {
        return this.input.isChecked();
    }

    async check() {
        await this.label.check();
    }

    async uncheck() {
        await this.label.uncheck();
    }

    async click() {
        await this.label.click();
    }
}
