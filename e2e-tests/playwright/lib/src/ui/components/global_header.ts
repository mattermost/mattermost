// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

import type {ChannelsPage} from '../pages';

export default class GlobalHeader extends BaseComponent {
    readonly channelsPage: ChannelsPage;

    readonly accountMenuButton;
    readonly productSwitchMenu;
    readonly recentMentionsButton;
    readonly savedMessagesButton;
    readonly settingsButton;
    readonly searchBox;
    readonly userProfileMenu;

    constructor(channelsPage: ChannelsPage, container: Locator) {
        super(container);
        this.channelsPage = channelsPage;

        this.accountMenuButton = container.getByRole('button', {name: en['userAccountMenu.menuButton.ariaLabel']});
        this.productSwitchMenu = container.getByRole('button', {name: en['global_header.productSwitchMenu']});
        this.recentMentionsButton = container.getByRole('button', {name: en['channel_header.recentMentions']});
        this.savedMessagesButton = container.getByRole('button', {name: en['channel_header.flagged']});
        this.settingsButton = container.getByRole('button', {name: en['global_header.productSettings']});
        this.searchBox = container.locator('#searchFormContainer');
        this.userProfileMenu = container.locator('#userAccountMenuButton');
    }

    async toBeVisible(name?: string) {
        if (name) {
            await expect(this.container.getByRole('heading', {name})).toBeVisible();
        } else {
            await expect(this.container).toBeVisible();
        }
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
}
