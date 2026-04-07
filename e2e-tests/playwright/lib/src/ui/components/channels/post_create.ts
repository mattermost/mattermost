// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {Locator, expect} from '@playwright/test';

import {duration} from '@/util';
import {assetPath} from '@/file';
import {waitUntil} from '@/test_action';

export default class ChannelsPostCreate {
    readonly container: Locator;
    readonly input;

    readonly attachmentButton;
    readonly emojiButton;
    readonly sendMessageButton;
    readonly scheduleMessageButton;
    readonly priorityButton;
    readonly suggestionList;
    readonly filePreview;

    // Burn-on-Read elements
    readonly burnOnReadButton;
    readonly burnOnReadLabel;

    constructor(container: Locator, isRHS = false) {
        this.container = container;

        if (!isRHS) {
            this.input = container.getByTestId('post_textbox');
        } else {
            this.input = container.getByTestId('reply_textbox');
        }

        this.attachmentButton = container.locator('#fileUploadButton');
        this.emojiButton = container.getByLabel('select an emoji');
        this.sendMessageButton = container.getByTestId('SendMessageButton');
        this.scheduleMessageButton = container.getByLabel('Schedule message');
        this.priorityButton = container.getByLabel('Message priority');
        this.suggestionList = container.getByRole('listbox', {name: 'Suggestions'});
        this.filePreview = container.locator('.file-preview__container');

        // Burn-on-Read elements
        // Use a flexible locator that matches the aria-label pattern
        this.burnOnReadButton = container.getByRole('button', {name: /Burn-on-read/i});
        this.burnOnReadLabel = container.locator('.BurnOnReadLabel');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();

        await this.input.waitFor();
        await expect(this.input).toBeVisible();
    }

    /**
     * It just writes the message in the input and doesn't send it
     * @param message : Message to be written in the input
     */
    async writeMessage(message: string) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        await this.input.fill(message);
    }

    /**
     * Returns the value of the message input
     */
    async getInputValue() {
        await expect(this.input).toBeVisible();
        return await this.input.inputValue();
    }

    /**
     * Sends the message already written in the input
     */
    async sendMessage() {
        await expect(this.input).toBeVisible();
        const messageInputValue = await this.getInputValue();
        expect(messageInputValue).not.toBe('');

        await expect(this.sendMessageButton).toBeVisible();
        await expect(this.sendMessageButton).toBeEnabled();

        await this.sendMessageButton.click();
    }

    /**
     * Opens the message priority menu
     */
    async openPriorityMenu() {
        await expect(this.priorityButton).toBeVisible();
        await expect(this.priorityButton).toBeEnabled();
        await this.priorityButton.click();
    }

    /**
     * Composes and sends a message
     */
    async postMessage(message: string, files?: string[]) {
        await this.writeMessage(message);

        if (files) {
            const filePaths = files.map((file) => path.join(assetPath, file));
            this.container.page().once('filechooser', async (fileChooser) => {
                await fileChooser.setFiles(filePaths);
            });

            // Click on the attachment button
            await this.attachmentButton.click();

            // Wait until the file preview is displayed
            await this.waitUntilFilePreviewContains(files);
        }

        await this.sendMessage();
    }

    async openEmojiPicker() {
        await expect(this.emojiButton).toBeVisible();
        await this.emojiButton.click();
    }

    async waitUntilFilePreviewContains(files: string[], timeout = duration.ten_sec) {
        await waitUntil(
            async () => {
                const previews = this.filePreview.locator('.file-preview');
                const details = this.filePreview.locator('.post-image__details');

                const [previewsCount, detailsCount] = await Promise.all([previews.count(), details.count()]);

                return previewsCount === files.length && detailsCount === files.length;
            },
            {timeout},
        );
    }

    /**
     * Toggle the burn-on-read feature for the message
     */
    async toggleBurnOnRead() {
        await expect(this.burnOnReadButton).toBeVisible();
        await this.burnOnReadButton.click();
    }

    /**
     * Check if burn-on-read is currently enabled
     * BoR is considered enabled if the label is visible above the input
     */
    async isBurnOnReadEnabled(): Promise<boolean> {
        return await this.burnOnReadLabel.isVisible();
    }
}
