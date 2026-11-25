// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {createSurface} from '../../../../surface';

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

        const team = createSurface(container.page()).team_settings(container);
        this.nameInput = team.name.locator;
        this.descriptionInput = team.description.locator;
        this.uploadInput = team.iconUpload.locator;
        this.removeImageButton = team.iconRemove.locator;
        this.teamIconImage = team.iconImage.locator;
        this.teamIconInitial = team.iconInitial.locator;
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
