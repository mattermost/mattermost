// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

class SystemUsersFilterPopover {
    readonly container: Locator;

    readonly teamMenuInput: Locator;
    readonly roleMenuButton: Locator;
    readonly statusMenuButton: Locator;

    readonly applyButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.teamMenuInput = this.container.locator('#asyncTeamSelectInput');
        this.roleMenuButton = this.container.locator('#DropdownInput_filterRole');
        this.statusMenuButton = this.container.locator('#DropdownInput_filterStatus');

        this.applyButton = this.container.getByText('Apply');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.applyButton).toBeVisible();
    }

    /**
     * Save the filter settings.
     */
    async save() {
        await this.applyButton.click();
    }

    /**
     * Allows to type in the team filter for searching.
     */
    async searchInTeamMenu(teamDisplayName: string) {
        expect(this.teamMenuInput).toBeVisible();
        await this.teamMenuInput.fill(teamDisplayName);
    }

    /**
     * Opens the role filter menu.
     */
    async openRoleMenu() {
        expect(this.roleMenuButton).toBeVisible();
        await this.roleMenuButton.click();
    }

    /**
     * Opens the status filter menu.
     */
    async openStatusMenu() {
        expect(this.statusMenuButton).toBeVisible();
        await this.statusMenuButton.click();
    }

    /**
     * Closes the filter popover.
     */
    async close() {
        await this.container.press('Escape');
        await expect(this.container).not.toBeVisible();
    }
}

export {SystemUsersFilterPopover};
