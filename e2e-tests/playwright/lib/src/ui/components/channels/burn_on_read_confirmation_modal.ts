// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class BurnOnReadConfirmationModal {
    readonly container: Locator;
    readonly title: Locator;
    readonly message: Locator;
    readonly deleteButton: Locator;
    readonly cancelButton: Locator;
    readonly dontShowAgainCheckbox: Locator;

    constructor(container: Locator) {
        this.container = container;
        
        // Modal elements
        this.title = container.locator('.modal-title, h1, [role="heading"]').first();
        this.message = container.locator('.modal-body, .modal-message').first();
        
        // Action buttons - use flexible selectors
        this.deleteButton = container.getByRole('button', {name: /delete|burn|confirm/i});
        this.cancelButton = container.getByRole('button', {name: /cancel/i});
        
        // Checkbox for "don't show again" preference
        this.dontShowAgainCheckbox = container.getByRole('checkbox');
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
        return await this.dontShowAgainCheckbox.isVisible();
    }

    /**
     * Check if "don't show again" is already checked
     */
    async isDontShowAgainChecked(): Promise<boolean> {
        return await this.dontShowAgainCheckbox.isChecked();
    }
}

