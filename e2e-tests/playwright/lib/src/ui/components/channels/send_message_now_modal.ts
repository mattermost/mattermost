// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class SendMessageNowModal {
    readonly container: Locator;
    readonly body: Locator;
    readonly sendNowButton: Locator;
    readonly cancelButton: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.locator('.modal-body');
        this.sendNowButton = container.locator('button:has-text("Yes, send now")');
        this.cancelButton = container.locator('button:has-text("Cancel")');
        this.closeButton = container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
