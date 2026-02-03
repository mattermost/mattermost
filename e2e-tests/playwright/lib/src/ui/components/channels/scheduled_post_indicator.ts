// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ScheduledPostIndicator {
    readonly container: Locator;

    readonly icon;
    readonly messageText;
    readonly seeAllLink;
    readonly scheduledMessageLink;

    constructor(container: Locator) {
        this.container = container;

        this.icon = container.getByTestId('scheduledPostIcon');
        this.messageText = container.locator('span').first();
        this.seeAllLink = container.locator('a:has-text("See all")');
        this.scheduledMessageLink = container.locator('a:has-text("scheduled message")');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeNotVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async getText() {
        return await this.messageText.innerText();
    }
}
