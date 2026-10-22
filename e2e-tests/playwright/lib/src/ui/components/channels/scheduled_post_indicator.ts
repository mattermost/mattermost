// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

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
        this.seeAllLink = container.getByRole('link', {name: 'See all.'});
        this.scheduledMessageLink = container.getByRole('link', {name: /scheduled messages?/});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeNotVisible() {
        await expect(this.container).not.toBeVisible();
    }

    async getText() {
        return this.messageText.innerText();
    }
}
