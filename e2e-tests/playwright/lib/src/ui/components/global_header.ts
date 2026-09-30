// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import type {ChannelsPage} from '../pages';

import AboutBuildModal from './about_build_modal';

export default class GlobalHeader {
    readonly channelsPage: ChannelsPage;
    readonly container: Locator;

    readonly accountMenuButton;
    readonly switchProductMenuButton;
    readonly recentMentionsButton;
    readonly savedMessagesButton;
    readonly settingsButton;
    readonly helpButton;
    readonly searchBox;
    readonly userProfileMenu;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        this.channelsPage = channelsPage;
        this.container = container;

        this.accountMenuButton = container.getByRole('button', {name: "'s account menu"});
        this.switchProductMenuButton = container.getByRole('button', {name: 'Open product menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.savedMessagesButton = container.getByRole('button', {name: 'Saved messages'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
        this.helpButton = container.getByRole('button', {name: 'Help'});
        this.searchBox = container.locator('#searchFormContainer');
        this.userProfileMenu = container.locator('#userAccountMenuButton');
    }

    async toBeVisible(name: string) {
        await expect(this.container.getByRole('heading', {name})).toBeVisible();
    }

    async openSwitchProductMenu() {
        await this.switchProductMenuButton.click();
        await this.channelsPage.switchProductMenu.toBeVisible();

        return this.channelsPage.switchProductMenu;
    }

    /**
     * Opens the product switch menu and selects the "App Marketplace" item.
     */
    async openAppMarketplace() {
        const menu = await this.openSwitchProductMenu();
        await menu.openMarketplace();
    }

    /**
     * Opens the product switch menu and selects the "User Groups" item.
     */
    async openUserGroups() {
        const menu = await this.openSwitchProductMenu();
        await menu.openUserGroups();
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

    /**
     * Opens the product switch menu and selects "About {siteName}", returning the modal.
     */
    async openAbout(): Promise<AboutBuildModal> {
        const menu = await this.openSwitchProductMenu();
        await menu.openAbout();

        const aboutModal = new AboutBuildModal(this.container.page().getByRole('dialog', {name: /^About /}));
        await aboutModal.toBeVisible();
        return aboutModal;
    }
}
