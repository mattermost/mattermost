// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class GlobalHeader {
    readonly container: Locator;

    readonly productSwitchMenu;
    readonly recentMentionsButton;
    readonly settingsButton;

    constructor(container: Locator) {
        this.container = container;

        this.productSwitchMenu = container.getByRole('button', {name: 'Product switch menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }

    async switchProduct(name: string) {
        await this.productSwitchMenu.click();
        await this.container.getByRole('link', {name}).click();
    }

    async openSettings() {
        await expect(this.settingsButton).toBeVisible();
        await this.settingsButton.click();
    }

    async openRecentMentions() {
        await expect(this.recentMentionsButton).toBeVisible();
        await this.recentMentionsButton.click();
    }
}

export {GlobalHeader};
