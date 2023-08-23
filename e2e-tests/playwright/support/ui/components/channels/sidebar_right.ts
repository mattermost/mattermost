// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

import {components} from '@e2e-support/ui/components';

export default class ChannelsSidebarRight {
    readonly container: Locator;

    readonly input;
    readonly sendMessageButton;
    readonly closeButton;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByTestId('reply_textbox');
        this.sendMessageButton = container.getByTestId('SendMessageButton');

        this.closeButton = container.locator('#rhsCloseButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async postMessage(message: string) {
        await this.writeMessage(message);
        await this.sendMessage();
    }

    async writeMessage(message: string) {
        await this.input.fill(message);
    }

    async sendMessage() {
        await this.sendMessageButton.click();
    }

    /**
     * Returns the value of the textbox in RHS
     */
    async getInputValue() {
        return await this.input.inputValue();
    }

    /**
     * Returns the RHS post by post id
     * @param postId Just the ID without the prefix
     */
    async getRHSPostById(postId: string) {
        const rhsPostId = `rhsPost_${postId}`;
        const postLocator = this.container.locator(`#${rhsPostId}`);
        return new components.ChannelsPost(postLocator);
    }

    /**
     * Closes the RHS
     */
    async close() {
        await this.closeButton.waitFor();
        await this.closeButton.click();

        await expect(this.container).not.toBeVisible();
    }
}

export {ChannelsSidebarRight};
