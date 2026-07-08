// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Delegated Granular Administration -> Role Edit -> Add Users modal
 */
export default class AddUsersToRoleModal {
    readonly container: Locator;
    readonly searchInput: Locator;
    readonly addButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.searchInput = container.getByRole('combobox', {name: 'Search for people'});
        this.addButton = container.getByRole('button', {name: 'Add'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async searchAndSelectUser(username: string) {
        await this.searchInput.click();
        await this.searchInput.pressSequentially(username, {delay: 50});

        const userRow = this.container.locator('div').filter({hasText: username});
        await expect(userRow).toBeVisible();
        await userRow.click();
    }

    async submit() {
        await this.addButton.click();
    }
}
