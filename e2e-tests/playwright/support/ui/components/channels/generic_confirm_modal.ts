// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

/**
 * This is the generic confirm modal that is used in the app.
 * It has optional cancel button, optional checkbox and confirm button along with title and message body.
 * It can present in different parts of the app such as channel, system console, etc and hence its constructor
 * should be able to accept the page object of the app and an optional id to uniquely identify the modal.
 */
export default class GenericConfirmModal {
    readonly container: Locator;

    readonly confirmButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.confirmButton = container.locator('#confirmModalButton');
        this.cancelButton = container.locator('#cancelModalButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirm() {
        await this.confirmButton.waitFor();
        await this.confirmButton.click();

        // Wait for the modal to disappear
        await expect(this.container).not.toBeVisible();
    }

    async cancel() {
        await this.cancelButton.waitFor();
        await this.cancelButton.click();

        // Wait for the modal to disappear
        await expect(this.container).not.toBeVisible();
    }
}

export {GenericConfirmModal};
