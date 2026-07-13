// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class MarketplaceModal {
    readonly container: Locator;

    readonly closeButton;

    constructor(container: Locator) {
        this.container = container;

        this.closeButton = container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async close() {
        await this.closeButton.click();
    }
}
