// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ChannelsHeader extends BaseComponent {
    readonly title: Locator;
    readonly channelMenuDropdown;
    readonly callButton: Locator;
    readonly archivedMessage: Locator;
    readonly membersButton: Locator;

    constructor(container: Locator) {
        super(container);

        this.title = container.locator('#channelHeaderTitle');
        this.channelMenuDropdown = container.getByTestId('channelMenuDropdown');
        this.callButton = container.getByRole('button', {name: en['generic_icons.call']}).first();
        this.archivedMessage = container.locator('#channelArchivedMessage');
        this.membersButton = container.locator('#channelMembers');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toHaveTitle(title: string) {
        await expect(this.title).toContainText(title);
    }

    async openChannelMenu() {
        await this.channelMenuDropdown.isVisible();
        await this.channelMenuDropdown.click();
    }

    async openCalls() {
        await expect(this.callButton).toBeVisible();
        await this.callButton.click();
    }
}
