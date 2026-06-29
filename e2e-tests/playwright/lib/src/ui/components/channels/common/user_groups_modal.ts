// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

export default class UserGroupsModal extends BaseComponent {
    readonly searchInput: Locator;
    readonly createGroupButton: Locator;
    readonly filterDropdown: Locator;
    readonly filterMenuAllGroups: Locator;
    readonly filterMenuMyGroups: Locator;
    readonly filterMenuArchivedGroups: Locator;

    constructor(container: Locator) {
        super(container);

        this.searchInput = container.getByTestId('searchInput');
        this.createGroupButton = container.getByRole('button', {name: en['user_groups_modal.createNew']});
        this.filterDropdown = container.locator('#groupsFilterDropdown');
        this.filterMenuAllGroups = container.locator('#groupsDropdownAll');
        this.filterMenuMyGroups = container.locator('#groupsDropdownMy');
        this.filterMenuArchivedGroups = container.locator('#groupsDropdownArchived');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    getGroupActionMenuButton(groupId: string): Locator {
        return this.container.locator(`#customWrapper-${groupId}`);
    }

    getViewGroupMenuItem(): Locator {
        return this.container.locator('#view-group');
    }

    getArchiveGroupMenuItem(): Locator {
        return this.container.locator('#archive-group');
    }

    getRestoreGroupMenuItem(): Locator {
        return this.container.locator('#restore-group');
    }

    async searchGroups(query: string): Promise<void> {
        await this.searchInput.fill(query);
    }

    async openFilter(): Promise<void> {
        await this.filterDropdown.click();
    }

    async filterByAllGroups(): Promise<void> {
        await this.openFilter();
        await this.filterMenuAllGroups.click();
    }

    async filterByMyGroups(): Promise<void> {
        await this.openFilter();
        await this.filterMenuMyGroups.click();
    }

    async filterByArchivedGroups(): Promise<void> {
        await this.openFilter();
        await this.filterMenuArchivedGroups.click();
    }
}
