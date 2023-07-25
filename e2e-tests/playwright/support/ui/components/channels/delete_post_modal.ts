// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class DeletePostModal {
    readonly container: Locator;
    readonly confirmButton: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.confirmButton = this.container.locator('#deletePostModalButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirm() {
        await this.confirmButton.waitFor();
        await this.confirmButton.click();

        // Wait for the modal to disappear
        await expect(this.container).not.toBeVisible();
    }
}

export {DeletePostModal};
