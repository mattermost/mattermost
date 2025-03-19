// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';
import path from 'node:path';
import {waitUntil} from '@e2e-support/test_action';

export default class ChannelsPostCreate {
    readonly container: Locator;
    readonly input;

    readonly attachmentButton;
    readonly emojiButton;
    readonly sendMessageButton;
    readonly scheduleDraftMessageButton;
    readonly priorityButton;
    readonly suggestionList;

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
        this.scheduleDraftMessageButton = container.getByLabel('Schedule message');
        this.priorityButton = container.getByLabel('Message priority');
        this.suggestionList = container.getByTestId('suggestionList');
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
     * Click on Scheduled Draft button to open options
     */
    async clickOnScheduleDraftDropdownButton() {
        await expect(this.input).toBeVisible();

        await expect(this.scheduleDraftMessageButton).toBeVisible();
        await expect(this.scheduleDraftMessageButton).toBeEnabled();

        await this.scheduleDraftMessageButton.click();
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
            const filePaths = files.map((file) => path.join(path.resolve(__dirname), '../../../asset', file));
            this.container.page().once('filechooser', async (fileChooser) => {
                await fileChooser.setFiles(filePaths);
            });

            await this.attachmentButton.click();

            // wait for all files to be uploaded
            await waitUntil(async () => {
                const attachment = await this.container.locator('.file-preview').count();
                return attachment === files.length;
            });
        }

        await this.sendMessage();
    }

    async openEmojiPicker() {
        await expect(this.emojiButton).toBeVisible();
        await this.emojiButton.click();
    }
}

export {ChannelsPostCreate};
