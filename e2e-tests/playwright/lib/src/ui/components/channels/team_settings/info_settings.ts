// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class InfoSettings {
    readonly container: Locator;

    readonly nameInput;
    readonly descriptionInput;
    readonly uploadInput;
    readonly removeImageButton;
    readonly teamIconImage;
    readonly teamIconInitial;

    constructor(container: Locator) {
        this.container = container;

        this.nameInput = container.locator('input#teamName');
        this.descriptionInput = container.locator('textarea#teamDescription');
        this.uploadInput = container.locator('input[data-testid="uploadPicture"]');
        this.removeImageButton = container.locator('button[data-testid="removeImageButton"]');
        this.teamIconImage = container.locator('#teamIconImage');
        this.teamIconInitial = container.locator('#teamIconInitial');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async updateName(name: string) {
        await expect(this.nameInput).toBeVisible();
        await this.nameInput.clear();
        await this.nameInput.fill(name);
    }

    async updateDescription(description: string) {
        await expect(this.descriptionInput).toBeVisible();
        await this.descriptionInput.clear();
        await this.descriptionInput.fill(description);
    }

    async uploadIcon(filePath: string) {
        await this.uploadInput.setInputFiles(filePath);
        await expect(this.teamIconImage).toBeVisible();
    }

    async removeIcon() {
        await expect(this.removeImageButton).toBeVisible();
        await this.removeImageButton.click();
        await expect(this.teamIconInitial).toBeVisible();
    }
}
