// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {ConfirmModal} from '@/ui/components/system_console/base_modal';

/**
 * System Console -> Plugins -> Plugin Management
 */
export default class PluginManagement {
    readonly container: Locator;

    readonly pluginFileInput: Locator;
    readonly uploadButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        // A plain <input type="file">, no testid/id — exactly one on this page.
        this.pluginFileInput = container.locator('input[type="file"]');
        this.uploadButton = container.locator('#uploadPlugin');
    }

    async toBeVisible() {
        await expect(this.container.getByText('Plugin Management', {exact: true})).toBeVisible();
    }

    /**
     * Locates an installed plugin's row by its manifest id.
     */
    pluginRow(pluginId: string): Locator {
        return this.container.getByTestId(pluginId);
    }

    async notToHavePlugin(pluginId: string) {
        await expect(this.pluginRow(pluginId)).not.toBeVisible();
    }

    /**
     * Removes the given plugin via its "Remove" control and confirms the "Remove plugin?" dialog.
     * The Enable/Remove controls in this list aren't real buttons or links (no ARIA role, no href),
     * so this uses a scoped text locator rather than getByRole.
     */
    async removePlugin(pluginId: string) {
        const row = this.pluginRow(pluginId);
        await row.getByText('Remove', {exact: true}).click();

        const confirmModal = new ConfirmModal(this.container.page().getByRole('dialog', {name: 'Remove plugin?'}));
        await confirmModal.toBeVisible();
        await confirmModal.confirm();
    }

    /**
     * Uploads a plugin bundle (.tar.gz) via the real <input type="file">, then clicks "Upload".
     * If a plugin with the same id is already installed, confirms the "Overwrite existing
     * plugin?" dialog that appears instead of failing.
     */
    async uploadPlugin(filePath: string) {
        await this.pluginFileInput.setInputFiles(filePath);
        await expect(this.uploadButton).toBeEnabled();
        await this.uploadButton.click();

        const overwriteDialog = this.container.page().getByRole('dialog', {name: 'Overwrite existing plugin?'});
        if (await overwriteDialog.isVisible().catch(() => false)) {
            const confirmModal = new ConfirmModal(overwriteDialog);
            await confirmModal.confirm();
        }
    }

    /**
     * Clicks "Enable" on an already-installed plugin's row. Uploading a plugin does not
     * auto-enable it — this is always a separate step.
     */
    async enablePlugin(pluginId: string) {
        const row = this.pluginRow(pluginId);
        await row.getByText('Enable', {exact: true}).click();
    }

    async toBeEnabled(pluginId: string) {
        await expect(this.pluginRow(pluginId).getByText('Enable', {exact: true})).not.toBeVisible();
    }
}
