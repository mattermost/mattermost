// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {Locator, expect} from '@playwright/test';

import DeletePostConfirmationDialog from './delete_post_confirmation_dialog';
import RestorePostConfirmationDialog from './restore_post_confirmation_dialog';

import {assetPath} from '@/file';

export default class ChannelsPostEdit {
    readonly container: Locator;
    readonly input;

    readonly attachmentButton;
    readonly emojiButton;
    readonly sendMessageButton;
    readonly deleteConfirmationDialog;
    readonly restorePostConfirmationDialog;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByTestId('edit_textbox');

        this.attachmentButton = container.locator('#fileUploadButton');
        this.emojiButton = container.getByLabel('select an emoji');
        this.sendMessageButton = container.locator('.save');
        this.deleteConfirmationDialog = new DeletePostConfirmationDialog(container.page().locator('#deletePostModal'));
        this.restorePostConfirmationDialog = new RestorePostConfirmationDialog(
            container.page().locator('#restorePostModal'),
        );
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();

        await this.input.waitFor();
        await expect(this.input).toBeVisible();
    }

    async toNotBeVisible() {
        await expect(this.input).not.toBeVisible();
    }

    async writeMessage(message: string) {
        await this.input.waitFor();
        await expect(this.input).toBeVisible();

        await this.input.clear();
        await this.input.fill(message);
    }

    async addFiles(files: string[]) {
        const filePaths = files.map((file) => path.join(assetPath, file));
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

    async sendMessage() {
        await this.input.scrollIntoViewIfNeeded();

        await expect(this.sendMessageButton).toBeVisible();
        await expect(this.sendMessageButton).toBeEnabled();

        await this.sendMessageButton.click();
    }

    async postMessage(message: string) {
        await this.writeMessage(message);
        await this.sendMessage();
    }

    async toContainText(text: string) {
        await expect(this.container).toContainText(text);
    }
}
