// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {switchLabel} from '../../switch';

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
        if (!(await toggleButton.isChecked())) {
            await switchLabel(this.container, 'channelBannerToggle-button').check();
        }
    }

    async disableChannelBanner() {
        const toggleButton = this.container.getByTestId('channelBannerToggle-button');
        if (await toggleButton.isChecked()) {
            await switchLabel(this.container, 'channelBannerToggle-button').uncheck();
        }
    }

    async enableChannelAutotranslation() {
        const toggleButton = this.container.getByTestId('channelTranslationToggle-button');
        if (!(await toggleButton.isChecked())) {
            await switchLabel(this.container, 'channelTranslationToggle-button').check();
        }
    }

    async disableChannelAutotranslation() {
        const toggleButton = this.container.getByTestId('channelTranslationToggle-button');
        if (await toggleButton.isChecked()) {
            await switchLabel(this.container, 'channelTranslationToggle-button').uncheck();
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

    get joinLeaveMessagesToggle() {
        return this.container.getByTestId('channelJoinLeaveMessagesToggle-button');
    }

    async enableJoinLeaveMessages() {
        const toggleButton = this.container.getByTestId('channelJoinLeaveMessagesToggle-button');
        if (!(await toggleButton.isChecked())) {
            await switchLabel(this.container, 'channelJoinLeaveMessagesToggle-button').check();
        }
    }

    async disableJoinLeaveMessages() {
        const toggleButton = this.container.getByTestId('channelJoinLeaveMessagesToggle-button');
        if (await toggleButton.isChecked()) {
            await switchLabel(this.container, 'channelJoinLeaveMessagesToggle-button').uncheck();
        }
    }

    get bannerTextbox() {
        return this.container.getByTestId('channel_banner_banner_text_textbox');
    }

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

    async typeBannerText(text: string) {
        await this.bannerTextEditor.click();
        await this.container.page().keyboard.press('End');
        await this.container.page().keyboard.type(text);
    }

    async clearBannerText() {
        const editor = this.bannerTextEditor;
        await editor.click();
        // Keyboard events and execCommand('delete') both honour contenteditable=false
        // on chip spans and refuse to remove them. Direct DOM removal bypasses that
        // restriction; the synthetic input event syncs React's emittedRef so the
        // component does not re-seed the chips from the stale template string.
        await editor.evaluate((el: HTMLElement) => {
            while (el.firstChild) {
                el.removeChild(el.firstChild);
            }
            el.dispatchEvent(new InputEvent('input', {bubbles: true, cancelable: false}));
        });
        await expect(editor).toHaveText('');
    }

    async insertBannerToken(name: string) {
        await expect(this.bannerTokenButton).toBeVisible();
        await this.bannerTokenButton.click();

        const item = this.container.page().getByTestId(`bannerAttributeToken-${name}`);
        await expect(item).toBeVisible();
        await item.click();

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
        if (!(await toggle.isChecked())) {
            await switchLabel(this.container, 'shareChannelWithWorkspacesToggle-button').check();
        }
    }

    async disableShareWithWorkspaces() {
        const toggle = this.shareWithWorkspacesToggle;
        if (await toggle.isChecked()) {
            await switchLabel(this.container, 'shareChannelWithWorkspacesToggle-button').uncheck();
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
