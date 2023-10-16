// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class ChannelsSidebarLeft {
    readonly container: Locator;
    readonly findChannelButton;

    constructor(container: Locator) {
        this.container = container;

        this.findChannelButton = container.getByRole('button', {name: 'Find Channels'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Clicks on the sidebar channel link with the given name.
     * It can be any sidebar item name including channels, direct messages, or group messages, threads, etc.
     * @param channelName
     */
    async goToItem(channelName: string) {
        const channel = this.container.locator(`#sidebarItem_${channelName}`);
        await channel.waitFor();
        await channel.click();
    }

    /**
     * Verifies 'Drafts' as a sidebar link exists in LHS.
     */
    async draftsVisible() {
        const draftSidebarLink = this.container.getByText('Drafts', {exact: true});
        await draftSidebarLink.waitFor();
        await expect(draftSidebarLink).toBeVisible();
    }

    /**
     * Verifies 'Drafts' as a sidebar link does not exist in LHS.
     */
    async draftsNotVisible() {
        const channel = this.container.getByText('Drafts', {exact: true});
        await expect(channel).not.toBeVisible();
    }
}

export {ChannelsSidebarLeft};
