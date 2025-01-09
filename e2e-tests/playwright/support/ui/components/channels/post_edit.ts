// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';
import path from 'node:path';
import {components} from '@e2e-support/ui/components';

export default class ChannelsPostEdit {
    readonly container: Locator;
    readonly input;

    readonly attachmentButton;
    readonly emojiButton;
    readonly sendMessageButton;
    readonly deleteConfirmationDialog;

    // readonly scheduleDraftMessageButton;
    // readonly priorityButton;
    // readonly suggestionList;

    constructor(container: Locator, isRHS = false) {
        this.container = container;

        // if (!isRHS) {
        //     this.input = container.getByTestId('edit_textbox');
        // } else {
        //     this.input = container.getByTestId('reply_textbox');
        // }

        this.input = container.getByTestId('edit_textbox');

        this.attachmentButton = container.locator('#fileUploadButton');
        this.emojiButton = container.getByLabel('select an emoji');
        this.sendMessageButton = container.locator('.save');
        // this.scheduleDraftMessageButton = container.getByLabel('Schedule message');
        // this.priorityButton = container.getByLabel('Message priority');
        // this.suggestionList = container.getByTestId('suggestionList');

        this.deleteConfirmationDialog = new components.DeletePostConfirmationDialog(container.page().locator('#deletePostModal'));
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

    async addFiles(files: string[]) {
        const filePaths = files.map((file) => path.join(path.resolve(__dirname), '../../../asset', file));
        this.container.page().once('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(filePaths);
        });

        await this.attachmentButton.click();
    }

    async removeFile(fileName: string) {
        const files = await this.container.locator(`.file-preview`).all();

        for (let i = 0; i < files.length; i++) {
            const textContent = await files[i].textContent();
            if (textContent?.includes(fileName)) {
                const removeButton = files[i].locator('.icon-close');
                await removeButton.click();
                break;
            }
        }
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
        // const messageInputValue = await this.getInputValue();
        // expect(messageInputValue).not.toBe('');

        await expect(this.sendMessageButton).toBeVisible();
        await expect(this.sendMessageButton).toBeEnabled();

        await this.sendMessageButton.click();
    }

    /**
     * Click on Scheduled Draft button to open options
     */
    // async clickOnScheduleDraftDropdownButton() {
    //     await expect(this.input).toBeVisible();
    //
    //     await expect(this.scheduleDraftMessageButton).toBeVisible();
    //     await expect(this.scheduleDraftMessageButton).toBeEnabled();
    //
    //     await this.scheduleDraftMessageButton.click();
    // }

    /**
     * Opens the message priority menu
     */
    // async openPriorityMenu() {
    //     await expect(this.priorityButton).toBeVisible();
    //     await expect(this.priorityButton).toBeEnabled();
    //     await this.priorityButton.click();
    // }

    /**
     * Composes and sends a message
     */
    async postMessage(message: string) {
        await this.writeMessage(message);
        await this.sendMessage();
    }

    async openEmojiPicker() {
        await expect(this.emojiButton).toBeVisible();
        await this.emojiButton.click();
    }
}

export {ChannelsPostEdit};
