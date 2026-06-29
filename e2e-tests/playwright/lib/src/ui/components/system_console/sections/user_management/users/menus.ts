// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export {FilterPopover} from './filter_popover';

/**
 * Column toggle menu that appears when clicking the Columns button
 */
export class ColumnToggleMenu extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get a menu item by text
     */
    async getMenuItem(menuItem: string): Promise<Locator> {
        const menuItemLocator = this.container.getByRole('menuitemcheckbox').filter({hasText: menuItem});
        await menuItemLocator.waitFor();
        return menuItemLocator;
    }

    /**
     * Get all menu items
     */
    getAllMenuItems(): Locator {
        return this.container.getByRole('menuitemcheckbox');
    }

    /**
     * Click a menu item to toggle it
     */
    async clickMenuItem(menuItem: string) {
        const item = await this.getMenuItem(menuItem);
        await item.click();
    }

    /**
     * Close the menu
     */
    async close() {
        await this.container.press('Escape');
        await expect(this.container).not.toBeVisible();
    }
}

/**
 * Generic filter menu for role/status dropdowns (react-select dropdown)
 */
export class FilterMenu extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Get a menu item by text
     */
    async getMenuItem(menuItem: string): Promise<Locator> {
        const menuItemLocator = this.container.getByText(menuItem);
        await menuItemLocator.waitFor();
        return menuItemLocator;
    }

    /**
     * Click a menu item (this also closes the dropdown automatically)
     */
    async clickMenuItem(menuItem: string) {
        const item = await this.getMenuItem(menuItem);
        await item.click();
        // Dropdown closes automatically after selection, wait for it
        await expect(this.container).not.toBeVisible({timeout: 5000});
    }

    /**
     * Close the menu (if still open)
     */
    async close() {
        const isVisible = await this.container.isVisible();
        if (isVisible) {
            await this.container.press('Escape');
        }
    }
}

/**
 * Date range selector menu
 */
export class DateRangeMenu extends BaseComponent {
    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Click a menu item
     */
    async clickMenuItem(menuItem: string) {
        const item = this.container.getByText(menuItem);
        await item.waitFor();
        await item.click();
    }

    /**
     * Close the menu
     */
    async close() {
        await this.container.press('Escape');
    }
}
