// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class BurnOnReadConcealedPlaceholder {
    readonly container: Locator;
    readonly icon: Locator;
    readonly text: Locator;

    constructor(container: Locator) {
        this.container = container;
        
        // The container itself is the button - no need for nested locator
        this.icon = container.locator('.BurnOnReadConcealedPlaceholder__icon');
        this.text = container.locator('.BurnOnReadConcealedPlaceholder__text');
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

