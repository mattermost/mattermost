// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class PostDotMenu {
    readonly container: Locator;

    readonly deleteMenuItem;

    constructor(container: Locator) {
        this.container = container;

        this.deleteMenuItem = this.container.getByText('Delete', {exact: true});   
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async delete() {
        await this.deleteMenuItem.waitFor();
        await this.deleteMenuItem.click();
    }
}

export {PostDotMenu};
