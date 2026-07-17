// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import {expect} from '@playwright/test';

import {duration} from '@/util';

/**
 * Shared group-sync controls on Team Configuration and Channel Configuration.
 */
export default class SyncableConfiguration {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async save(confirm = false) {
        await this.page.getByRole('button', {name: 'Save', exact: true}).click();
        if (confirm) {
            await this.page.getByRole('dialog').getByRole('button', {name: /^Yes,/}).click();
        }
    }

    async addGroup(groupDisplayName: string) {
        await this.page.getByRole('button', {name: 'Add Group', exact: true}).click();
        const dialog = this.page.getByRole('dialog').last();
        await expect(dialog).toBeVisible({timeout: duration.half_min});
        const searchInput = dialog.getByRole('combobox', {name: 'Search and add groups', exact: true});
        await searchInput.fill(groupDisplayName);
        await expect(dialog.getByRole('status')).toContainText('1 result');
        await searchInput.press('ArrowDown');
        await searchInput.press('Enter');
        await dialog.getByRole('button', {name: 'Add', exact: true}).click();
        await expect(this.page.getByText(groupDisplayName, {exact: true}).first()).toBeVisible();
    }

    async changeGroupRole(fromRole: string, toRole: string) {
        const currentRole = this.page.getByText(fromRole, {exact: true}).first();
        await expect(currentRole).toBeVisible({timeout: duration.half_min});
        await currentRole.click();
        const menu = this.page.getByRole('menu').last();
        await expect(menu.getByRole('menuitem')).toHaveCount(1);
        await menu.getByRole('menuitem', {name: toRole, exact: true}).click();
    }

    async expectGroupRole(role: string) {
        await expect(this.page.getByText(role, {exact: true}).first()).toBeVisible({timeout: duration.half_min});
    }

    async removeGroup(groupDisplayName: string) {
        await expect(this.page.getByText(groupDisplayName, {exact: true})).toBeVisible();
        await this.page.getByRole('link', {name: 'Remove', exact: true}).click();
        await this.expectNoGroups();
    }

    async expectNoGroups() {
        await expect(this.page.getByText('No groups specified yet', {exact: true})).toBeVisible();
    }
}
