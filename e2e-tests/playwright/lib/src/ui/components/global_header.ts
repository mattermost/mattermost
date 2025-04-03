// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import {ChannelsPage} from '../pages';

export default class GlobalHeader {
    readonly channelsPage: ChannelsPage;
    readonly container: Locator;

    readonly accountMenuButton;
    readonly productSwitchMenu;
    readonly recentMentionsButton;
    readonly settingsButton;
    readonly searchBox;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        this.channelsPage = channelsPage;
        this.container = container;

        this.accountMenuButton = container.getByRole('button', {name: "'s account menu"});
        this.productSwitchMenu = container.getByRole('button', {name: 'Product switch menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
        this.searchBox = container.locator('#searchFormContainer');
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

        await this.channelsPage.settingsModal.toBeVisible();

        return this.channelsPage.settingsModal;
    }

    async openRecentMentions() {
        await expect(this.recentMentionsButton).toBeVisible();
        await this.recentMentionsButton.click();
    }

    async openSearch() {
        await expect(this.searchBox).toBeVisible();
        await this.searchBox.click();
    }

    async closeSearch() {
        await expect(this.searchBox).toBeVisible();
        await this.searchBox.getByTestId('searchBoxClose').click();
    }
}
