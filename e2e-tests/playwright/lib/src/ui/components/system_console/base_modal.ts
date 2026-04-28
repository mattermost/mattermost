// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

/**
 * Base modal component for System Console modals.
 * Can be extended or used directly for various modal dialogs.
 */
export default class BaseModal {
    readonly container: Locator;
    readonly title: Locator;
    readonly closeButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.modal-title');
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async close() {
        await this.closeButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async cancel() {
        await this.cancelButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async clickButton(name: string) {
        await this.container.getByRole('button', {name}).click();
    }
}

/**
 * Confirm modal with specific confirm button ID (#confirmModalButton)
 */
export class ConfirmModal extends BaseModal {
    readonly confirmButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.confirmButton = container.locator('#confirmModalButton');
    }

    async confirm() {
        await this.confirmButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
