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
import type {ElementDriver} from '../../surface/drivers';

export default class Switch {
    readonly input: Locator;
    readonly label: Locator;

    /**
     * @param container - the element the switch is in
     * @param target - the input's `data-testid`, or its surface part (`createSurface(page).scope(root).part`);
     *   omit when `container` holds a single switch
     */
    constructor(container: Locator, target?: string | ElementDriver) {
        const page = container.page();
        let input: Locator;
        let inLabel: Locator;
        if (typeof target === 'string') {
            input = container.getByTestId(target);
            inLabel = page.getByTestId(target);
        } else if (target) {
            input = target.locator;
            inLabel = page.locator(target.selector);
        } else {
            input = container.getByRole('switch');
            inLabel = page.getByRole('switch');
        }
        this.input = input;

        // `has` is matched inside each label, so it takes a page-rooted locator.
        this.label = container.locator('label').filter({has: inLabel});
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
