// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class LinkPreview {
    readonly container: Locator;
    readonly image;
    readonly hideImageButton;
    readonly showImageButton;
    readonly removeButton;

    constructor(container: Locator) {
        this.container = container;
        this.image = container.getByRole('img', {name: /.+/});
        this.hideImageButton = container.getByRole('button', {name: 'Hide image preview'});
        this.showImageButton = container.getByRole('button', {name: 'Show image preview'});
        this.removeButton = container.getByRole('button', {name: 'Remove'});
    }

    async toBeVisible(timeout?: number) {
        await expect(this.container).toBeVisible({timeout});
    }

    async toHaveExpandedImage() {
        await expect(this.image).toBeVisible();
        await expect(this.hideImageButton).toBeVisible();
    }

    async hideImage() {
        await this.hideImageButton.click();
        await expect(this.showImageButton).toBeVisible();
        await expect(this.image).not.toBeVisible();
    }

    async showImage() {
        await this.showImageButton.click();
        await expect(this.image).toBeVisible();
    }

    async remove() {
        await this.container.hover();
        await this.removeButton.click();
        await this.toNotBeVisible();
    }

    async toNotBeVisible() {
        await expect(this.container).not.toBeVisible();
    }
}
