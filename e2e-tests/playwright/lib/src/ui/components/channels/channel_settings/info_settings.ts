// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly headerInput: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
        this.headerInput = container.getByPlaceholder('Enter a header for this channel');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async updateName(name: string) {
        await expect(this.nameInput).toBeVisible();
        await this.nameInput.clear();
        await this.nameInput.fill(name);
    }

    async updateHeader(header: string) {
        await expect(this.headerInput).toBeVisible();
        await this.headerInput.fill(header);
    }
}
