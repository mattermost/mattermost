// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class DeletePostConfirmationDialog {
    readonly container: Locator;

    readonly cancelButton;
    readonly confirmButton;

    constructor(container: Locator) {
        this.container = container;

        this.cancelButton = container.locator('button.btn.btn-tertiary');
        this.confirmButton = container.locator('button#deletePostModalButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.cancelButton).toBeVisible();
        await expect(this.confirmButton).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
        await expect(this.cancelButton).not.toBeVisible();
        await expect(this.confirmButton).not.toBeVisible();
    }

    async cancelDeletion() {
        await this.cancelButton.click();
    }

    async confirmDeletion() {
        await this.confirmButton.click();
    }
}

export {DeletePostConfirmationDialog};
