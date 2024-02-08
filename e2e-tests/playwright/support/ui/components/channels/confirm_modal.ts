// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator, Page} from '@playwright/test';

export default class ConfirmModal {
    readonly container: Locator;

    constructor(page: Page) {
        this.container = page.locator("#confirmModal");
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async clickConfirmButton() {
        await this.toBeVisible();
        await this.container.locator('#confirmModalButton').click()
    }

    async clickCancelButton() {
        await this.toBeVisible();
        await this.container.locator('#cancelModalButton').click()
    }

    async closeModal() {
        await this.toBeVisible();
        await this.container.locator('button.close').click()
    }

    async waitForDetached() {
        await this.container.waitFor({state: "detached"})
    }
}

export {ConfirmModal};
