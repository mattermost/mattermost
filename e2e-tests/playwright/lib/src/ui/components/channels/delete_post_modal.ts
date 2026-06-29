// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class DeletePostModal extends BaseComponent {
    readonly confirmButton: Locator;

    constructor(container: Locator) {
        super(container);
        this.confirmButton = container.locator('#deletePostModalButton');
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
