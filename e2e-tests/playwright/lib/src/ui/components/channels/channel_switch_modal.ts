// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, type Locator, type Page} from '@playwright/test';

export default class ChannelSwitcheModal {
    readonly container: Locator;
    readonly page: Page

    readonly closeButton;
    readonly input;

    constructor(container: Locator, page: Page) {
        this.container = container;
        this.page = page;

        this.closeButton = container.getByRole('button', {name: 'Close'});
        this.input = container.getByRole('combobox', {name: 'quick switch input'});
    }

    async close() {
        await this.closeButton.click();

        await expect(this.container).not.toBeVisible();
    }

    async getOption(optionName: string) {
        return this.container.getByRole('option', {name: optionName});
    }
}
