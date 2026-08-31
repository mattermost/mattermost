// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelsHeader {
    readonly container: Locator;

    readonly title: Locator;
    readonly channelMenuDropdown;
    readonly callButton: Locator;
    readonly pinnedMessagesButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.title = container.locator('#channelHeaderTitle');
        this.channelMenuDropdown = container.locator('#channelHeaderDropdownButton');
        this.callButton = container.getByRole('button', {name: /call/i}).first();
        this.pinnedMessagesButton = container.locator('#channelHeaderPinButton');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveTitle(title: string) {
        await expect(this.title).toContainText(title);
    }

    async openChannelMenu() {
        const page = this.container.page();
        const mobileMenuButton = page.locator('#navbar #channelHeaderDropdownButton');
        const mobileVisible = await mobileMenuButton.isVisible({timeout: 1000}).catch(() => false);
        const menuButton = mobileVisible ? mobileMenuButton : this.channelMenuDropdown;

        await expect(menuButton).toBeVisible();
        await menuButton.scrollIntoViewIfNeeded();
        await menuButton.click();
    }

    async openCalls() {
        await expect(this.callButton).toBeVisible();
        await this.callButton.click();
    }

    async openPinnedMessages() {
        await expect(this.pinnedMessagesButton).toBeVisible();
        await this.pinnedMessagesButton.click();
    }
}
