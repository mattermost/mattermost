// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class SwitchProductMenu {
    readonly container: Locator;

    readonly channelsMenuItem: Locator;
    readonly systemConsoleMenuItem: Locator;
    readonly integrationsMenuItem: Locator;
    readonly userGroupsMenuItem: Locator;
    readonly marketplaceMenuItem: Locator;
    readonly downloadMenuItem: Locator;
    readonly aboutMenuItem: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.channelsMenuItem = container.getByRole('menuitem', {name: 'Channels'});
        this.systemConsoleMenuItem = container.getByRole('menuitem', {name: 'System Console'});
        this.integrationsMenuItem = container.getByRole('menuitem', {name: 'Integrations'});
        this.userGroupsMenuItem = container.getByRole('menuitem', {name: 'User groups'});
        this.marketplaceMenuItem = container.getByRole('menuitem', {name: 'Marketplace'});
        this.downloadMenuItem = container.getByRole('menuitem', {name: 'Download'});
        this.aboutMenuItem = container.getByRole('menuitem', {name: 'About'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async switchToChannelsProduct() {
        await this.channelsMenuItem.click();
    }

    async openSystemConsole() {
        await this.systemConsoleMenuItem.click();
    }

    async openIntegrations() {
        await this.integrationsMenuItem.click();
    }

    async openUserGroups() {
        await this.userGroupsMenuItem.click();
    }

    async openMarketplace() {
        await this.marketplaceMenuItem.click();
    }

    async openDownload() {
        await this.downloadMenuItem.click();
    }

    async openAbout() {
        await this.aboutMenuItem.click();
    }
}
