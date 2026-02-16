// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * System Console Navbar component
 */
export default class SystemConsoleNavbar {
    readonly container: Locator;
    readonly backLink: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.backLink = container.getByRole('link', {name: /Back/});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.backLink).toBeVisible();
    }

    /**
     * Click the back link to return to the team
     */
    async clickBack() {
        await this.backLink.click();
    }
}
