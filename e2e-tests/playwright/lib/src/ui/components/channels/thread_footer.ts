// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ThreadFooter {
    readonly container: Locator;

    readonly replyButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.replyButton = container.locator('.ReplyButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Clicks on the reply button in the thread footer to open the thread in RHS.
     */
    async reply() {
        await this.replyButton.waitFor();
        await this.replyButton.click();
    }
}

export {ThreadFooter};
