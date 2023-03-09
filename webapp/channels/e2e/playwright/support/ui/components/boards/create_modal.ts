// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class BoardsCreateModal {
    readonly locator: Locator;
    readonly productSwitchMenu: Locator;

    constructor(locator: Locator) {
        this.locator = locator;

        this.productSwitchMenu = locator.getByRole('button', {name: 'Product switch menu'});
    }

    async switchProduct(name: string) {
        await this.productSwitchMenu.click();
        await this.locator.getByRole('link', {name: ` ${name}`}).click();
    }

    async toBeVisible(name: string) {
        await expect(this.locator.getByRole('heading', {name})).toBeVisible();
    }
}

export {BoardsCreateModal};
