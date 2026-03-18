// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async updateName(name: string) {
        await expect(this.nameInput).toBeVisible();
        await this.nameInput.clear();
        await this.nameInput.fill(name);
    }
}
