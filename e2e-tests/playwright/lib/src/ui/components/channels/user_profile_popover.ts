// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class UserProfilePopover {
    readonly container: Locator;

    readonly messageButton;
    readonly attributeHeadings;
    readonly bottomRow;
    readonly avatarImage;

    constructor(container: Locator) {
        this.container = container;

        this.messageButton = container.getByRole('button', {name: 'Message'});
        this.attributeHeadings = container.getByRole('heading', {level: 3});
        this.bottomRow = container.getByTestId('user-profile-popover-bottom-row');
        this.avatarImage = container.locator('#userAvatar');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * True if the popover's avatar <img> actually loaded a real image (not broken/blank).
     */
    async hasLoadedAvatar(): Promise<boolean> {
        await expect(this.avatarImage).toBeVisible();
        return this.avatarImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    }

    /**
     * Clicks the "Message" button to open a direct message with the user.
     */
    async message() {
        await expect(this.messageButton).toBeVisible();
        await this.messageButton.click();
    }

    async close() {
        await this.container.getByLabel('Close user profile popover').click();
    }
}
