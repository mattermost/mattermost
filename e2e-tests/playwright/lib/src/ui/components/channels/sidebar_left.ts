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
     * Locates the sidebar link with the given name.
     * It can be any sidebar item name including channels, direct messages, or group messages, threads, etc.
     * Falls back to matching by visible text since some sidebar items (e.g. DMs) may not resolve by the plain ID.
     * @param name
     */
    item(name: string): Locator {
        return this.container
            .locator(`#sidebarItem_${name}`)
            .or(this.container.locator('.SidebarLink').filter({hasText: name}))
            .first();
    }

    /**
     * Clicks on the sidebar channel link with the given name.
     * @param channelName
     */
    async goToItem(channelName: string) {
        const channel = this.item(channelName);
        await channel.waitFor();
        await channel.click();
    }

    /**
     * Opens the channel options (dots) menu for a sidebar item, revealed on hover.
     * @param channelSlug The channel name used in the sidebar item id (URL slug).
     */
    async openChannelMenu(channelSlug: string) {
        const item = this.container.locator(`#sidebarItem_${channelSlug}`);
        await item.waitFor();
        await item.hover();
        await this.container.getByRole('button', {name: `Channel options for ${channelSlug}`}).click();
    }

    /**
     * Closes a direct/group message conversation via its sidebar channel menu.
     */
    async closeConversation(channelSlug: string) {
        await this.openChannelMenu(channelSlug);
        await this.container.page().getByRole('menuitem', {name: 'Close Conversation'}).click();
    }

    /**
     * Closes a conversation and waits for its sidebar item to disappear.
     */
    async closeConversationAndWait(channelSlug: string) {
        await this.closeConversation(channelSlug);
        await expect(this.container.locator(`#sidebarItem_${channelSlug}`)).not.toBeVisible();
    }

    /**
     * Verifies the sidebar item with the given name is in the unread state.
     * @param name
     */
    async assertItemUnread(name: string) {
        await expect(this.item(name)).toHaveClass(/unread|unread-title/);
    }

    /**
     * Verifies the sidebar item with the given name is in the read (not unread) state.
     * @param name
     */
    async assertItemRead(name: string) {
        await expect(this.item(name)).not.toHaveClass(/unread|unread-title/);
    }

    /**
     * Locates the unread-mentions count badge nested inside the sidebar item with the given name.
     * @param name
     */
    unreadMentionsBadge(name: string): Locator {
        return this.item(name).locator('#unreadMentions');
    }

    /**
     * Locates the group message member-count badge nested inside the sidebar item with the given name.
     * @param name
     */
    memberCountBadge(name: string): Locator {
        return this.item(name).locator('.status--group');
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
