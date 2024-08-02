// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class SystemConsoleSidebar {
    readonly container: Locator;

    readonly searchInput: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.searchInput = container.getByPlaceholder('Find settings');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.searchInput).toBeVisible();
    }

    /**
     * Clicks on the sidebar section link with the given name. Pass the exact name of the section.
     * @param sectionName
     */
    async goToItem(sectionName: string) {
        const section = this.container.getByText(sectionName, {exact: true});
        await section.waitFor();
        await section.click();
    }

    /**
     * Searches for the given item in the sidebar search input.
     * @param itemName
     */
    async searchForItem(itemName: string) {
        await this.searchInput.fill(itemName);
    }
}

export {SystemConsoleSidebar};
