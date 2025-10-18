// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ChannelIntro {
    readonly container: Locator;

    // Main elements
    readonly title: Locator;
    readonly description: Locator;

    // Action buttons
    readonly favoriteButton: Locator;
    readonly setHeaderButton: Locator;
    readonly notificationsButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        // Main elements
        this.title = container.locator('.channel-intro__title');
        this.description = container.locator('.channel-intro__text');

        // Action buttons
        this.favoriteButton = container.getByRole('button', {name: 'Favorite'});
        this.setHeaderButton = container.getByRole('button', {name: 'Set header'});
        this.notificationsButton = container.getByRole('button', {name: 'Notifications'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async getChannelTitle() {
        return await this.title.textContent();
    }

    async getChannelDescription() {
        return await this.description.textContent();
    }

    async verifyChannelTitle(expectedTitle: string) {
        await expect(this.title).toHaveText(expectedTitle);
    }

    async verifyChannelDescription(expectedDescription: string) {
        await expect(this.description).toContainText(expectedDescription);
    }

    async clickFavoriteButton() {
        await this.favoriteButton.click();
    }

    async clickSetHeaderButton() {
        await this.setHeaderButton.click();
    }

    async clickNotificationsButton() {
        await this.notificationsButton.click();
    }
}
