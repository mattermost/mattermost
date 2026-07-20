// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class DeleteScheduledPostModal {
    readonly container: Locator;
    readonly body: Locator;
    readonly deleteButton: Locator;
    readonly cancelButton: Locator;
    readonly closeButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.body = container.locator('#confirmModalBody');
        this.deleteButton = container.getByRole('button', {name: 'Yes, delete'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
        this.closeButton = container.getByRole('button', {name: 'Close'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}
