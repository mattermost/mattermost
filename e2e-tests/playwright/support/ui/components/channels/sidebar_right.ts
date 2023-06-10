// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';
import {components} from '@e2e-support/ui/components';

export default class ChannelsSidebarRight {
    readonly container: Locator;

    readonly input;
    readonly sendButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByTestId('reply_textbox');
        this.sendButton = container.getByTestId('SendMessageButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async postMessage(message: string) {
        await this.input.fill(message);
    }

    async sendMessage() {
        await this.sendButton.click();
    }

    /**
     * Returns the value of the textbox in RHS
     * @returns 
     */
    async getTextboxValue() {
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
}

export {ChannelsSidebarRight};
