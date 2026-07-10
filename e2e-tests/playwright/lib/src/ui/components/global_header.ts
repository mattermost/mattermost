// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import type {ChannelsPage} from '../pages';

export default class GlobalHeader {
    readonly channelsPage: ChannelsPage;
    readonly container: Locator;

    readonly accountMenuButton;
    readonly productSwitchMenu;
    readonly recentMentionsButton;
    readonly savedMessagesButton;
    readonly settingsButton;
    readonly helpButton;
    readonly searchBox;
    readonly userProfileMenu;
    readonly appMarketplaceMenuItem;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        this.channelsPage = channelsPage;
        this.container = container;

        this.accountMenuButton = container.getByRole('button', {name: "'s account menu"});
        this.productSwitchMenu = container.getByRole('button', {name: 'Product switch menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.savedMessagesButton = container.getByRole('button', {name: 'Saved messages'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
        this.helpButton = container.getByRole('button', {name: 'Help'});
        this.searchBox = container.locator('#searchFormContainer');
        this.userProfileMenu = container.locator('#userAccountMenuButton');

        // Rendered in a portal at the page level once the product switch menu is open.
        this.appMarketplaceMenuItem = container.page().getByRole('menuitem', {name: 'App Marketplace'});
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }

    async switchProduct(name: string) {
        await this.productSwitchMenu.click();
        await this.container.getByRole('link', {name}).click();
    }

    /**
     * Opens the product switch menu and selects the "App Marketplace" item.
     */
    async openAppMarketplace() {
        await this.productSwitchMenu.click();
        await this.appMarketplaceMenuItem.click();
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

    async openSavedMessages() {
        await expect(this.savedMessagesButton).toBeVisible();
        await this.savedMessagesButton.click();
    }

    async openHelpMenu() {
        await expect(this.helpButton).toBeVisible();
        await this.helpButton.click();
    }

    /**
     * Opens the Help menu and selects the "Keyboard shortcuts" item.
     */
    async openKeyboardShortcuts() {
        await this.openHelpMenu();
        await this.container.page().getByRole('menuitem', {name: 'Keyboard shortcuts'}).click();
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
