// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsPostCreate {
    readonly container: Locator;
    readonly input: Locator;
    readonly attachmentButton: Locator;
    readonly emojiButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByTestId('post_textbox');
        this.attachmentButton = container.getByLabel('attachment');
        this.emojiButton = container.getByLabel('select an emoji');
    }

    async postMessage(message: string) {
        await this.input.fill(message);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.input).toBeVisible();
    }
}

export {ChannelsPostCreate};
