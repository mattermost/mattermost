// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

class SystemUsersColumnToggleMenu {
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
        const menuItemLocator = this.container.getByRole('menuitemcheckbox').filter({hasText: menuItem});
        await menuItemLocator.waitFor();

        return menuItemLocator;
    }

    /**
     * Returns the list of locators for all the menu items.
     */
    async getAllMenuItems() {
        const menuItemLocators = this.container.getByRole('menuitemcheckbox');
        return menuItemLocators;
    }

    /**
     * Pass in the item name to check/uncheck the menu item.
     */
    async clickMenuItem(menuItem: string) {
        const menuItemLocator = await this.getMenuItem(menuItem);
        await menuItemLocator.click();
    }

    /**
     * Close column toggle menu.
     */
    async close() {
        await this.container.press('Escape');
        await expect(this.container).not.toBeVisible();
    }
}

export {SystemUsersColumnToggleMenu};
