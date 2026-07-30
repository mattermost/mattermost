// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly headerInput: Locator;
    readonly defaultCategoryGroup: Locator;
    readonly defaultCategoryClear: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
        this.headerInput = container.getByPlaceholder('Enter a header for this channel');
        // Prefer test id: empty+unfocused CategorySelector hides its legend, so the group has no accessible name.
        this.defaultCategoryGroup = container.getByTestId('defaultCategorySelector');
        this.defaultCategoryClear = this.defaultCategoryGroup.getByTestId('categorySelectorClear');
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

    async clearDefaultCategory() {
        // Blur the channel name first so CategorySelector focus/clear cannot race
        // with ChannelNameFormField autofocus blur validation.
        await this.nameInput.blur();
        await expect(this.defaultCategoryClear).toBeVisible();
        await this.defaultCategoryClear.click();
        await expect(this.defaultCategoryClear).not.toBeVisible();
    }
}
