// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * Base modal component for System Console modals.
 * Can be extended or used directly for various modal dialogs.
 */
export default class BaseModal extends BaseComponent {
    readonly title: Locator;
    readonly closeButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.title = container.getByRole('heading').first();
        this.closeButton = container.getByRole('button', {name: en['generic.close']});
        this.cancelButton = container.getByRole('button', {name: en['generic_btn.cancel']});
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
        await expect(this.container).not.toBeVisible({timeout: 20000});
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
