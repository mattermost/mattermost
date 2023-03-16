// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class GlobalHeader {
    readonly container: Locator;
    readonly productSwitchMenu: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.productSwitchMenu = container.getByRole('button', {name: 'Product switch menu'});
    }

    async switchProduct(name: string) {
        await this.productSwitchMenu.click();
        await this.container.getByRole('link', {name: ` ${name}`}).click();
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }
}

export {GlobalHeader};
