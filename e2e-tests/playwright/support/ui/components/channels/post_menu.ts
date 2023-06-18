// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class PostMenu {
    readonly container: Locator;

    readonly replyButton;
    readonly dotMenuButton;

    constructor(container: Locator) {
        this.container = container;

        this.replyButton = container.getByRole('button', {name: 'reply'});
        this.dotMenuButton = container.getByRole('button', {name: 'more'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Clicks on the reply button from the post menu.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }

    /**
     * Clicks on the dot menu button from the post menu.
     */
    async openDotMenu() {
        await this.dotMenuButton.waitFor();
        await this.dotMenuButton.click();
    }
}

export {PostMenu};
