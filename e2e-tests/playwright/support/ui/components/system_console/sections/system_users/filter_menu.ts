// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

/**
 * The dropdown menu which appears for both Role and Status filter.
 */
class SystemUsersFilterMenu {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Return the locator for the menu item with the given name.
     */
    async getMenuItem(menuItem: string) {
        const menuItemLocator = this.container.getByText(menuItem);
        await menuItemLocator.waitFor();

        return menuItemLocator;
    }

    /**
     * Clicks on the menu item with the given name.
     */
    async clickMenuItem(menuItem: string) {
        const menuItemLocator = await this.getMenuItem(menuItem);
        await menuItemLocator.click();
    }

    /**
     * Close the menu.
     */
    async close() {
        await this.container.press('Escape');
    }
}

export {SystemUsersFilterMenu};
