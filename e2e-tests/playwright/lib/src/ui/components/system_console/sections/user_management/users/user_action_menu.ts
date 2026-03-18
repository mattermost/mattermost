// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * User action menu that appears when clicking the action button on a user row
 */
export class UserActionMenu {
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
    getMenuItem(text: string): Locator {
        return this.container.getByText(text, {exact: true});
    }

    /**
     * Click a menu item by text
     */
    async clickMenuItem(text: string) {
        const item = this.getMenuItem(text);
        await item.click();
    }

    async clickDeactivate() {
        await this.clickMenuItem('Deactivate');
    }

    async clickActivate() {
        await this.clickMenuItem('Activate');
    }

    async clickManageRoles() {
        await this.clickMenuItem('Manage roles');
    }

    async clickManageTeams() {
        await this.clickMenuItem('Manage teams');
    }

    async clickResetPassword() {
        await this.clickMenuItem('Reset password');
    }

    async clickUpdateEmail() {
        await this.clickMenuItem('Update email');
    }

    async clickRevokeSessions() {
        await this.clickMenuItem('Revoke sessions');
    }
}
