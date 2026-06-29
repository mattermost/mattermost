// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

/**
 * Export User Data confirmation modal
 * (System Console -> User Management -> Users -> Export)
 *
 * Rendered via ConfirmModalRedux with id='exportUserDataModal'.
 */
export default class ExportDataModal extends BaseComponent {
    /** Body text describing the date range that will be exported */
    readonly formatSelector: Locator;

    /** "Export data" confirm button */
    readonly downloadButton: Locator;

    /** "Do not show this again" checkbox */
    readonly doNotShowAgainCheckbox: Locator;

    /** Cancel button */
    readonly cancelButton: Locator;

    /** "Export is in progress" title shown when a duplicate export is attempted */
    readonly progressIndicator: Locator;

    constructor(container: Locator) {
        super(container);

        this.formatSelector = container.locator('#confirmModalBody');
        this.downloadButton = container.getByRole('button', {name: en['export_user_data_modal.export_data']});
        this.doNotShowAgainCheckbox = container.getByRole('checkbox');
        this.cancelButton = container.getByRole('button', {name: en['confirm_modal.cancel']});
        this.progressIndicator = container.getByRole('heading', {name: en['export_error_modal.inProgress.title']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * Click the "Export data" button to confirm the export.
     */
    async confirm() {
        await this.downloadButton.click();
        await this.toBeHidden();
    }

    /**
     * Click the cancel button to dismiss the modal.
     */
    async cancel() {
        await this.cancelButton.click();
        await this.toBeHidden();
    }

    /**
     * Check whether the "Do not show this again" checkbox is visible.
     */
    async hasDoNotShowAgainOption(): Promise<boolean> {
        return this.doNotShowAgainCheckbox.isVisible();
    }

    /**
     * Confirm the export and opt out of future confirmation dialogs.
     */
    async confirmAndDoNotShowAgain() {
        await this.doNotShowAgainCheckbox.check();
        await this.downloadButton.click();
        await this.toBeHidden();
    }

    /**
     * Return the body text describing which date range will be exported.
     */
    async getFormatText(): Promise<string> {
        return (await this.formatSelector.textContent()) ?? '';
    }

    /**
     * Verify that the "Export is in progress" heading is visible,
     * indicating a duplicate export was attempted.
     */
    async progressIndicatorToBeVisible() {
        await expect(this.progressIndicator).toBeVisible();
    }
}
