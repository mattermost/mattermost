// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly headerInput: Locator;
    readonly urlInput: Locator;
    readonly editUrlButton: Locator;
    readonly doneUrlButton: Locator;
    readonly duplicateUrlAlert: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
        this.headerInput = container.getByPlaceholder('Enter a header for this channel');
        this.urlInput = container.getByTestId('channelURLInput');
        this.editUrlButton = container.getByRole('button', {name: 'Edit'});
        this.doneUrlButton = container.getByRole('button', {name: 'Done'});
        this.duplicateUrlAlert = container.getByRole('alert');
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

    async openUrlEditor() {
        await this.editUrlButton.click();
        await expect(this.urlInput).toBeVisible();
    }

    async updateUrl(url: string) {
        await this.urlInput.fill(url);
        await this.doneUrlButton.click();
    }
}
