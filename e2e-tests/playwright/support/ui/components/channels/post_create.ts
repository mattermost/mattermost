// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsPostCreate {
    readonly container: Locator;

    readonly input;
    readonly attachmentButton;
    readonly emojiButton;
    readonly sendMessageButton;

    constructor(container: Locator, inRHS = false) {
        this.container = container;

        this.input = inRHS ? container.getByTestId('reply_textbox') : container.getByTestId('post_textbox');
        this.attachmentButton = container.getByLabel('attachment');
        this.emojiButton = container.getByLabel('select an emoji');
        this.sendMessageButton = container.getByTestId('SendMessageButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
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
     * Sends the message written in the input
     */
    async sendMessage() {
        await expect(this.sendMessageButton).toBeVisible();
        
        const messageInputValue = await this.getInputValue();
        expect(messageInputValue).not.toBe('');
        
        await this.sendMessageButton.click();
    }

    /**
     * Composes and sends a message
     */
    async postMessage(message: string) {
        await this.writeMessage(message);
        await this.sendMessage();
    }

    async openEmojiPicker() {
        await this.emojiButton.click();
    }
}

export {ChannelsPostCreate};
