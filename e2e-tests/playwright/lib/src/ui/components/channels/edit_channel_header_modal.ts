// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class EditChannelHeaderModal {
    readonly container: Locator;

    readonly input: Locator;
    readonly saveButton: Locator;
    readonly cancelButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.input = container.getByPlaceholder('Enter the Channel Header');
        this.saveButton = container.getByRole('button', {name: 'Save'});
        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async setHeader(header: string) {
        await expect(this.input).toBeVisible();
        await this.input.fill(header);
        await this.saveButton.click();
        await expect(this.container).not.toBeVisible();
    }

    async cancel() {
        await this.cancelButton.click();
        await expect(this.container).not.toBeVisible();
    }
}
