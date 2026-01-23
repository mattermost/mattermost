// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

export default class ChannelsHeader {
    readonly container: Locator;

    readonly channelMenuDropdown;

    constructor(container: Locator) {
        this.container = container;

        this.channelMenuDropdown = container.locator('[aria-controls="channelHeaderDropdownMenu"]');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async openChannelMenu() {
        await this.channelMenuDropdown.isVisible();
        await this.channelMenuDropdown.click();
    }
}
