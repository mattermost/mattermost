// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class SidebarCategoryMenu {
    readonly container: Locator;
    readonly favoriteMenuItem: Locator;
    readonly moveToMenuItem: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.favoriteMenuItem = container.page().getByRole('menuitem', {name: /Favorite/i});
        this.moveToMenuItem = container.page().getByRole('menuitem', {name: /Move to/i});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
