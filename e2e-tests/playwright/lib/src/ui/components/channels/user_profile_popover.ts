// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class UserProfilePopover {
    readonly container: Locator;

    readonly messageButton;
    readonly attributeHeadings;
    readonly bottomRow;

    constructor(container: Locator) {
        this.container = container;

        this.messageButton = container.getByRole('button', {name: 'Message'});
        this.attributeHeadings = container.getByRole('heading', {level: 3});
        this.bottomRow = container.getByTestId('user-profile-popover-bottom-row');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
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
