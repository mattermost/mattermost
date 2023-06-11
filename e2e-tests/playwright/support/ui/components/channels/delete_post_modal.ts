// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class DeletePostModal {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async confirmClick() {
        const confirmButton = this.container.locator('#deletePostModalButton');
        await confirmButton.waitFor();

        await confirmButton.click();

        await expect(this.container).not.toBeVisible();
    }
}

export {DeletePostModal};
