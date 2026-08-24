// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly headerInput: Locator;
    readonly urlLabel: Locator;
    readonly urlEditButton: Locator;
    readonly urlInput: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
        this.headerInput = container.getByPlaceholder('Enter a header for this channel');
        this.urlLabel = container.getByTestId('urlInputLabel');
        this.urlEditButton = container.getByRole('button', {name: 'Edit'});
        this.urlInput = container.getByTestId('channelURLInput');
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

    async updateUrl(url: string) {
        await expect(this.urlEditButton).toBeVisible();
        await this.urlEditButton.click();
        await expect(this.urlInput).toBeVisible();
        await this.urlInput.clear();
        await this.urlInput.fill(url);
    }
}
