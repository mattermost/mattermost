// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';

export default class InfoSettings extends BaseComponent {
    readonly nameInput: Locator;
    readonly managedCategoryInput: Locator;

    constructor(container: Locator) {
        super(container);
        this.nameInput = container.locator('#input_channel-settings-name');
        this.managedCategoryInput = container.getByRole('combobox');
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
