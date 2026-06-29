// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class BurnOnReadConcealedPlaceholder extends BaseComponent {
    readonly icon: Locator;
    readonly text: Locator;

    constructor(container: Locator) {
        super(container);

        this.icon = container.getByTestId('burnOnReadConcealedIcon');
        this.text = container.getByTestId('burnOnReadConcealedText');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * Click to reveal the concealed message
     * The container itself is the clickable button
     */
    async clickToReveal() {
        await this.container.click();
    }

    /**
     * Wait for the reveal process to complete
     * The placeholder should disappear after successful reveal
     */
    async waitForReveal(timeout = 5000) {
        await expect(this.container).not.toBeVisible({timeout});
    }

    /**
     * Get the placeholder text (e.g., "View message")
     */
    async getText(): Promise<string> {
        return (await this.text.textContent()) || '';
    }

    /**
     * Get the aria-label of the button
     */
    async getAriaLabel(): Promise<string> {
        return (await this.container.getAttribute('aria-label')) || '';
    }
}
