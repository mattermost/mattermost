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
    readonly productSwitchMenu;
    readonly recentMentionsButton;
    readonly savedMessagesButton;
    readonly settingsButton;
    readonly searchBox;
    readonly userProfileMenu;
    readonly appMarketplaceMenuItem;
    readonly userGroupsMenuItem;
    readonly aboutMenuItem;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        this.channelsPage = channelsPage;
        this.container = container;

        this.accountMenuButton = container.getByRole('button', {name: "'s account menu"});
        this.productSwitchMenu = container.getByRole('button', {name: 'Product switch menu'});
        this.recentMentionsButton = container.getByRole('button', {name: 'Recent mentions'});
        this.savedMessagesButton = container.getByRole('button', {name: 'Saved messages'});
        this.settingsButton = container.getByRole('button', {name: 'Settings'});
        this.searchBox = container.locator('#searchFormContainer');
        this.userProfileMenu = container.locator('#userAccountMenuButton');

        // Rendered in a portal at the page level once the product switch menu is open.
        this.appMarketplaceMenuItem = container.page().getByRole('menuitem', {name: 'App Marketplace'});
        this.userGroupsMenuItem = container.page().getByRole('menuitem', {name: 'User Groups'});
        this.aboutMenuItem = container.page().getByRole('menuitem', {name: /^About /});
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
        await this.productSwitchMenu.click();
        await this.aboutMenuItem.click();

        const aboutModal = new AboutBuildModal(this.container.page().getByRole('dialog', {name: /^About /}));
        await aboutModal.toBeVisible();
        return aboutModal;
    }
}
