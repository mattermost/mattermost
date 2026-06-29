// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class RestorePostConfirmationDialog extends BaseComponent {
    readonly cancelButton;
    readonly confirmButton;

    constructor(container: Locator) {
        super(container);

        this.cancelButton = container.locator('button.btn.btn-tertiary');
        this.confirmButton = container.locator('button.GenericModal__button.btn.btn-primary.confirm');
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
