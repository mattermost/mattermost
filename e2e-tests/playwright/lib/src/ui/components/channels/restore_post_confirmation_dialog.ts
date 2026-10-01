// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class RestorePostConfirmationDialog {
    readonly container: Locator;

    readonly cancelButton;
    readonly confirmButton;

    constructor(container: Locator) {
        this.container = container;

        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.confirmButton = container.locator('button.GenericModal__button.confirm');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.cancelButton).toBeVisible();
        await expect(this.confirmButton).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async confirmRestore() {
        await this.confirmButton.click();
    }
}
