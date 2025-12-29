// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import {ChannelsPage} from '../pages';

export default class GlobalHeader {
    readonly channelsPage: ChannelsPage;
    readonly container: Locator;

    readonly accountMenuButton;
    readonly switchProductMenuButton;
    readonly recentMentionsButton;
    readonly savedMessagesButton;
    readonly settingsButton;
    readonly searchBox;
    readonly userProfileMenu;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        this.channelsPage = channelsPage;
        this.container = container;

        this.accountMenuButton = container.getByRole('button', {name: "'s account menu"});
        this.switchProductMenuButton = container.getByRole('button', {name: 'Switch product menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.savedMessagesButton = container.getByRole('button', {name: 'Saved messages'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
        this.searchBox = container.locator('#searchFormContainer');
        this.userProfileMenu = container.locator('#userAccountMenuButton');
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }

    async openSwitchProductMenu(name: string) {
        await this.switchProductMenuButton.click();
        await this.channelsPage.switchProductMenu.toBeVisible();

        return this.channelsPage.switchProductMenu;
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

    async openUserProfileMenu() {
        await expect(this.userProfileMenu).toBeVisible();
        await this.userProfileMenu.click();
    }

    async closeSearch() {
        await expect(this.searchBox).toBeVisible();
        await this.searchBox.getByTestId('searchBoxClose').click();
    }
}
