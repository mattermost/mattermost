// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {ChannelInfoAttributes} from '../channel_attributes';

export default class InfoSettings {
    readonly container: Locator;
    readonly nameInput: Locator;
    readonly purposeInput: Locator;
    readonly headerInput: Locator;
    readonly urlLabel: Locator;
    readonly urlEditButton: Locator;
    readonly urlInput: Locator;
    readonly saveChangesPanel: Locator;
    readonly saveButton: Locator;
    readonly resetButton: Locator;
    readonly attributes: ChannelInfoAttributes;

    constructor(container: Locator) {
        this.container = container;
        this.nameInput = container.locator('#input_channel-settings-name');
        this.purposeInput = container.getByPlaceholder('Enter a purpose for this channel (optional)');
        this.headerInput = container.getByPlaceholder('Enter a header for this channel');
        this.urlLabel = container.getByTestId('urlInputLabel');
        this.urlEditButton = container.getByRole('button', {name: 'Edit'});
        this.urlInput = container.getByTestId('channelURLInput');
        this.saveChangesPanel = container.locator('.SaveChangesPanel');
        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
        this.resetButton = container.getByTestId('SaveChangesPanel__cancel-btn');

        // Same component as the Channel Info RHS, but staged here: edits only
        // reach the server on this tab's own Save (see saveChangesPanel).
        this.attributes = new ChannelInfoAttributes(container.getByTestId('channelInfoAttributes'));
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

    async updatePurpose(purpose: string) {
        await expect(this.purposeInput).toBeVisible();
        await this.purposeInput.fill(purpose);
    }

    async save() {
        await expect(this.saveButton).toBeVisible();
        await this.saveButton.click();
    }

    async resetChanges() {
        await expect(this.resetButton).toBeVisible();
        await this.resetButton.click();
    }
}
