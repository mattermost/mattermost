// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The User Groups list modal, opened from the product menu's "User Groups" item.
 */
export default class UserGroupsModal {
    readonly container: Locator;

    readonly createGroupButton;
    readonly searchInput;
    readonly filterButton;

    constructor(container: Locator) {
        this.container = container;

        this.createGroupButton = container.getByRole('button', {name: 'Create Group'});
        this.searchInput = container.getByTestId('searchInput');
        this.filterButton = container.locator('#groupsFilterDropdown');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Locates a group row by its display name.
     */
    getGroup(displayName: string): Locator {
        return this.container.getByRole('button', {name: `${displayName} group`, exact: true});
    }

    async openGroup(displayName: string) {
        await this.getGroup(displayName).click();
    }

    /**
     * Switches the list filter to show archived groups.
     */
    async filterArchived() {
        await this.filterButton.click();
        await this.container.page().getByRole('menuitem', {name: 'Archived Groups'}).click();
    }
}
