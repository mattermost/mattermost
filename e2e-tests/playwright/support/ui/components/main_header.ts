// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class MainHeader {
    readonly container: Locator;

    readonly logo;
    readonly backButton;

    constructor(container: Locator) {
        this.container = container;

        this.logo = container.locator('.header-logo-link');
        this.backButton = container.getByTestId('back_button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

export {MainHeader};
