// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class BurnOnReadConfirmationModal extends BaseComponent {
    readonly title: Locator;
    readonly message: Locator;
    readonly deleteButton: Locator;
    readonly cancelButton: Locator;
    readonly dontShowAgainCheckbox: Locator;

    constructor(container: Locator) {
        super(container);

        this.title = container.getByRole('heading', {name: en['post.burn_on_read.confirmation_modal.title']});
        this.message = container.locator('#confirmModalBody');
        this.deleteButton = container.getByRole('button', {name: en['post.burn_on_read.confirmation_modal.confirm']});
        this.cancelButton = container.getByTestId('cancel-button');
        this.dontShowAgainCheckbox = container.getByLabel(en['post.burn_on_read.confirmation_modal.checkbox']);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * Confirm deletion without checking "don't show again"
     */
    async confirm() {
        await this.deleteButton.click();
        await this.toBeHidden();
    }

    /**
     * Confirm deletion and check "don't show again"
     */
    async confirmWithDontShowAgain() {
        await this.dontShowAgainCheckbox.check();
        await this.deleteButton.click();
        await this.toBeHidden();
    }

    /**
     * Cancel the deletion
     */
    async cancel() {
        await this.cancelButton.click();
        await this.toBeHidden();
    }

    /**
     * Get the modal title text
     */
    async getTitleText(): Promise<string> {
        return (await this.title.textContent()) || '';
    }

    /**
     * Get the modal message text
     */
    async getMessageText(): Promise<string> {
        return (await this.message.textContent()) || '';
    }

    /**
     * Check if "don't show again" checkbox is present
     */
    async hasDontShowAgainOption(): Promise<boolean> {
        return this.dontShowAgainCheckbox.isVisible();
    }

    /**
     * Check if "don't show again" is already checked
     */
    async isDontShowAgainChecked(): Promise<boolean> {
        return this.dontShowAgainCheckbox.isChecked();
    }
}
