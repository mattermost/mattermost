// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class NotificationPreferencesModal {
    readonly container: Locator;

    // Header elements
    readonly closeButton: Locator;
    readonly modalTitle: Locator;
    readonly channelName: Locator;

    // Mute or ignore section
    readonly muteChannelCheckbox: Locator;
    readonly ignoreMentionsCheckbox: Locator;

    // Desktop notifications section
    readonly desktopNotifyAllRadio: Locator;
    readonly desktopNotifyMentionRadio: Locator;
    readonly desktopNotifyNoneRadio: Locator;
    readonly desktopReplyThreadsCheckbox: Locator;
    readonly desktopNotificationSoundsCheckbox: Locator;
    readonly desktopNotificationSoundsSelect: Locator;

    // Mobile notifications section
    readonly sameMobileSettingsDesktopCheckbox: Locator;

    // Auto follow threads section
    readonly autoFollowThreadsCheckbox: Locator;

    // Footer buttons
    readonly cancelButton: Locator;
    readonly saveButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Header elements
        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.modalTitle = container.locator('#mm-modal-header-channelNotificationModalLabel');
        this.channelName = container.locator('.mm-modal-header__subtitle');

        // Mute or ignore section
        this.muteChannelCheckbox = container.getByTestId('muteChannel');
        this.ignoreMentionsCheckbox = container.getByTestId('ignoreMentions');

        // Desktop notifications section
        this.desktopNotifyAllRadio = container.getByTestId('desktopNotification-all');
        this.desktopNotifyMentionRadio = container.getByTestId('desktopNotification-mention');
        this.desktopNotifyNoneRadio = container.getByTestId('desktopNotification-none');
        this.desktopReplyThreadsCheckbox = container.getByTestId('desktopReplyThreads');
        this.desktopNotificationSoundsCheckbox = container.getByTestId('desktopNotificationSoundsCheckbox');
        this.desktopNotificationSoundsSelect = container.locator('#desktopNotificationSoundsSelect');

        // Mobile notifications section
        this.sameMobileSettingsDesktopCheckbox = container.getByTestId('sameMobileSettingsDesktop');

        // Auto follow threads section
        this.autoFollowThreadsCheckbox = container.getByTestId('autoFollowThreads');

        // Footer buttons
        this.cancelButton = container.locator('button:has-text("Cancel")');
        this.saveButton = container.locator('button:has-text("Save")');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getContainerId() {
        return this.container.getAttribute('id');
    }

    async close() {
        await this.closeButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async cancel() {
        await this.cancelButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async save() {
        await this.saveButton.click();
        await expect(this.container).not.toBeVisible();
    }

    // Mute or ignore actions
    async toggleMuteChannel() {
        await this.muteChannelCheckbox.click();
    }

    async toggleIgnoreMentions() {
        await this.ignoreMentionsCheckbox.click();
    }

    async isMuteChannelChecked() {
        return await this.muteChannelCheckbox.isChecked();
    }

    async isIgnoreMentionsChecked() {
        return await this.ignoreMentionsCheckbox.isChecked();
    }

    // Desktop notification actions
    async selectDesktopNotifyAll() {
        await this.desktopNotifyAllRadio.click();
    }

    async selectDesktopNotifyMention() {
        await this.desktopNotifyMentionRadio.click();
    }

    async selectDesktopNotifyNone() {
        await this.desktopNotifyNoneRadio.click();
    }

    async getSelectedDesktopNotification() {
        if (await this.desktopNotifyAllRadio.isChecked()) {
            return 'all';
        }
        if (await this.desktopNotifyMentionRadio.isChecked()) {
            return 'mention';
        }
        if (await this.desktopNotifyNoneRadio.isChecked()) {
            return 'none';
        }
        return null;
    }

    async toggleDesktopReplyThreads() {
        await this.desktopReplyThreadsCheckbox.click();
    }

    async isDesktopReplyThreadsChecked() {
        return await this.desktopReplyThreadsCheckbox.isChecked();
    }

    async toggleDesktopNotificationSounds() {
        await this.desktopNotificationSoundsCheckbox.click();
    }

    async isDesktopNotificationSoundsChecked() {
        return await this.desktopNotificationSoundsCheckbox.isChecked();
    }

    async selectDesktopNotificationSound(soundName: string) {
        await this.desktopNotificationSoundsSelect.click();
        await this.container.page().getByRole('option', {name: soundName}).click();
    }

    async getSelectedDesktopNotificationSound() {
        return await this.desktopNotificationSoundsSelect.locator('.react-select__single-value').textContent();
    }

    // Mobile notification actions
    async toggleSameMobileSettingsDesktop() {
        await this.sameMobileSettingsDesktopCheckbox.click();
    }

    async isSameMobileSettingsDesktopChecked() {
        return await this.sameMobileSettingsDesktopCheckbox.isChecked();
    }

    // Auto follow threads actions
    async toggleAutoFollowThreads() {
        await this.autoFollowThreadsCheckbox.click();
    }

    async isAutoFollowThreadsChecked() {
        return await this.autoFollowThreadsCheckbox.isChecked();
    }

    // Verification methods
    async verifyChannelName(expectedName: string) {
        await expect(this.channelName).toHaveText(expectedName);
    }

    async verifyModalTitle() {
        await expect(this.modalTitle).toContainText('Notification Preferences');
    }
}
