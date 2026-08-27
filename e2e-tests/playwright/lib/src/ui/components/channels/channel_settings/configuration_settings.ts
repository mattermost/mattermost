// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ConfigurationSettings {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async save() {
        const saveButton = this.container.getByTestId('SaveChangesPanel__save-btn');

        // Wait up to 5s for the save panel to appear. Some toggle-only changes
        // (e.g. disable sharing after a reload) may not trigger the save panel
        // if the component auto-synchronises or the panel has a render delay.
        const isVisible = await saveButton.isVisible().catch(() => false);
        if (!isVisible) {
            await saveButton.waitFor({state: 'visible', timeout: 5000}).catch(() => {
                // Panel didn't appear — change may already be applied or nothing to save.
            });

            // Double-check — if still not visible, bail out silently.
            const stillNotVisible = !(await saveButton.isVisible().catch(() => false));
            if (stillNotVisible) {
                return;
            }
        }

        await saveButton.click();
        const unshareConfirm = this.container.page().getByRole('button', {name: 'Yes, unshare'});
        try {
            await unshareConfirm.waitFor({state: 'visible', timeout: 2000});
            await unshareConfirm.click();
        } catch {
            // No unshare confirmation modal; save proceeded directly
        }

        // Wait for save to either succeed (panel hides) or enter an error state.
        // Do not throw on error — callers that need to handle service-unavailable cases
        // (e.g. Remote Cluster Service not running) can inspect the result via API after save.
        await expect
            .poll(
                async () => {
                    if (!(await saveButton.isVisible())) {
                        return 'hidden';
                    }
                    return (await saveButton.getAttribute('class')) ?? '';
                },
                {timeout: 10000},
            )
            .toMatch(/hidden|error/);
    }

    async enableChannelBanner() {
        const toggleButton = this.container.getByTestId('channelBannerToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (!classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async disableChannelBanner() {
        const toggleButton = this.container.getByTestId('channelBannerToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async enableChannelAutotranslation() {
        const toggleButton = this.container.getByTestId('channelTranslationToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (!classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async disableChannelAutotranslation() {
        const toggleButton = this.container.getByTestId('channelTranslationToggle-button');
        const classes = await toggleButton.getAttribute('class');
        if (classes?.includes('active')) {
            await toggleButton.click();
        }
    }

    async setChannelBannerText(text: string) {
        const textBox = this.container.getByTestId('channel_banner_banner_text_textbox');
        await expect(textBox).toBeVisible();
        await textBox.fill(text);
    }

    async setChannelBannerBackgroundColor(color: string) {
        const colorInput = this.container.locator('#channel_banner_banner_background_color_picker-inputColorValue');
        await expect(colorInput).toBeVisible();
        await colorInput.fill(color);
        expect((await colorInput.inputValue()).replace('#', '')).toBe(color);
    }

    get bannerTextbox() {
        return this.container.getByTestId('channel_banner_banner_text_textbox');
    }

    /**
     * The chip editor that replaces the plain textbox once channel attributes are on.
     */
    get bannerTextEditor() {
        return this.container.getByTestId('bannerTextEditor');
    }

    get bannerTokenButton() {
        return this.container.getByTestId('bannerAttributeTokenButton');
    }

    get bannerTokenPreview() {
        return this.container.getByTestId('bannerAttributePreview');
    }

    bannerTokenChip(name: string) {
        return this.container.getByTestId(`bannerTextEditorChip-${name}`);
    }

    bannerTokenChipRemove(name: string) {
        return this.container.getByTestId(`bannerTextEditorChipRemove-${name}`);
    }

    /**
     * Types literal banner text at the end of the chip editor, leaving existing chips.
     */
    async typeBannerText(text: string) {
        await this.bannerTextEditor.click();
        await this.container.page().keyboard.press('End');
        await this.container.page().keyboard.type(text);
    }

    async clearBannerText() {
        await this.bannerTextEditor.click();
        await this.container.page().keyboard.press('ControlOrMeta+A');
        await this.container.page().keyboard.press('Backspace');
        await expect(this.bannerTextEditor).toHaveText('');
    }

    async insertBannerToken(name: string) {
        await expect(this.bannerTokenButton).toBeVisible();
        await this.bannerTokenButton.click();

        const item = this.container.page().getByTestId(`bannerAttributeToken-${name}`);
        await expect(item).toBeVisible();
        await item.click();

        // One click inserts exactly one chip, so a double-insert fails at its source
        // rather than as a puzzling banner assertion later.
        await expect(this.bannerTokenChip(name)).toHaveCount(1);
    }

    async removeBannerToken(name: string) {
        await this.container.getByTestId(`bannerTextEditorChipRemove-${name}`).click();
        await expect(this.bannerTokenChip(name)).toHaveCount(0);
    }

    get shareWithConnectedWorkspacesSection() {
        return this.container.getByText('Share with connected workspaces');
    }

    get shareWithWorkspacesToggle() {
        return this.container.getByTestId('shareChannelWithWorkspacesToggle-button');
    }

    async isShareWithWorkspacesSectionVisible(): Promise<boolean> {
        return this.shareWithConnectedWorkspacesSection.isVisible();
    }

    async enableShareWithWorkspaces() {
        const toggle = this.shareWithWorkspacesToggle;
        const ariaPressed = await toggle.getAttribute('aria-pressed');
        const classes = await toggle.getAttribute('class');
        if (ariaPressed !== 'true' && !classes?.includes('active')) {
            await toggle.click();
        }
    }

    async disableShareWithWorkspaces() {
        const toggle = this.shareWithWorkspacesToggle;
        const ariaPressed = await toggle.getAttribute('aria-pressed');
        const classes = await toggle.getAttribute('class');
        if (ariaPressed === 'true' || classes?.includes('active')) {
            await toggle.click();
        }
    }

    /**
     * Opens the "Add workspace" dropdown and selects the first available workspace.
     * Call after enableShareWithWorkspaces() so the dropdown is visible. Required for save to apply.
     */
    async addFirstAvailableWorkspace() {
        const addButton = this.container.getByRole('button', {name: 'Add workspace'});
        await expect(addButton).toBeVisible();
        await addButton.click();
        const firstWorkspaceItem = this.container.page().locator('[id^="add_workspace_to_channel_menu-item-"]').first();
        await expect(firstWorkspaceItem).toBeVisible({timeout: 5000});
        await firstWorkspaceItem.click();
    }
}
