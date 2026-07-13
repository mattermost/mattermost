// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelBookmarksCreateModal {
    readonly container: Locator;

    readonly linkInput;
    readonly titleInput;
    readonly addButton;
    readonly cancelButton;

    constructor(container: Locator) {
        this.container = container;

        this.linkInput = container.getByTestId('linkInput');
        this.titleInput = container.getByTestId('titleInput');
        this.addButton = container.getByRole('button', {name: 'Add bookmark'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async notToBeVisible() {
        await expect(this.container).not.toBeVisible();
    }

    /**
     * Fills the link field and confirms, creating a link bookmark.
     */
    async addLink(url: string) {
        await this.linkInput.fill(url);
        await this.addButton.click();
    }
}
