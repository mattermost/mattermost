// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelsSidebarLeft {
    readonly container: Locator;

    readonly teamMenuButton: Locator;
    readonly browseOrCreateChannelButton: Locator;
    readonly findChannelButton;
    readonly scheduledPostBadge;
    readonly unreadChannelFilter;
    readonly openDirectMessageButton;

    constructor(container: Locator) {
        this.container = container;

        this.teamMenuButton = container.locator('#sidebarTeamMenuButton');
        this.browseOrCreateChannelButton = container.locator('#browseOrAddChannelMenuButton');
        this.findChannelButton = container.getByRole('button', {name: 'Find Channels'});
        this.scheduledPostBadge = container.getByTestId('scheduled-post-badge');
        this.unreadChannelFilter = container.getByTestId('sidebar-unread-filter-button');
        this.openDirectMessageButton = container.getByRole('button', {name: 'Write a direct message'});
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

    /**
     * Verifies if 'unreads' filter is applied to sidebar.
     */
    async isUnreadsFilterActive(): Promise<boolean> {
        return this.unreadChannelFilter.evaluate((el) => el.classList.contains('active'));
    }

    /**
     * Toggles the unread filter on or off.
     */
    async toggleUnreadsFilter() {
        await this.unreadChannelFilter.click();
    }

    /**
     * Gets all unread channel items in the sidebar.
     */
    getUnreadChannels(): Locator {
        return this.container.getByTestId('sidebar-unread-channel');
    }
}
