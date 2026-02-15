// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * Column toggle menu that appears when clicking the Columns button
 */
export class ColumnToggleMenu {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

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
 * Filter popover that appears when clicking the Filters button
 */
export class FilterPopover {
    readonly container: Locator;
    readonly teamMenuInput: Locator;
    readonly roleMenuButton: Locator;
    readonly statusMenuButton: Locator;
    readonly applyButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.teamMenuInput = container.locator('#asyncTeamSelectInput');
        this.roleMenuButton = container.locator('#DropdownInput_filterRole');
        this.statusMenuButton = container.locator('#DropdownInput_filterStatus');
        this.applyButton = container.getByText('Apply');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.applyButton).toBeVisible();
    }

    /**
     * Save/apply the filter settings and wait for popover to close
     */
    async save() {
        await this.applyButton.click();
        // Apply button closes the popover, wait for it to close
        await expect(this.container).not.toBeVisible({timeout: 5000});
    }

    /**
     * Search in the team filter and wait for dropdown options
     */
    async searchInTeamMenu(teamDisplayName: string) {
        await expect(this.teamMenuInput).toBeVisible();
        await this.teamMenuInput.fill(teamDisplayName);
        // Wait a bit for async search results to appear
        await this.container.page().waitForTimeout(500);
    }

    /**
     * Open the role filter menu
     */
    async openRoleMenu() {
        await expect(this.roleMenuButton).toBeVisible();
        await this.roleMenuButton.click();
    }

    /**
     * Open the status filter menu
     */
    async openStatusMenu() {
        await expect(this.statusMenuButton).toBeVisible();
        await this.statusMenuButton.click();
    }

    /**
     * Close the popover (if still open)
     */
    async close() {
        const isVisible = await this.container.isVisible();
        if (isVisible) {
            await this.container.press('Escape');
            await expect(this.container).not.toBeVisible();
        }
    }
}

/**
 * Generic filter menu for role/status dropdowns (react-select dropdown)
 */
export class FilterMenu {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

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
export class DateRangeMenu {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

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
