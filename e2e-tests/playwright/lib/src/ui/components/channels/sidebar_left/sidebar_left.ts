// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import {BaseComponent} from '@/ui/base_component';
import en from '@/i18n';

export default class ChannelsSidebarLeft extends BaseComponent {
    readonly teamMenuButton: Locator;
    readonly browseOrCreateChannelButton: Locator;
    readonly findChannelButton;
    readonly scheduledPostBadge;
    readonly unreadChannelFilter;
    readonly openDirectMessageButton;
    readonly toggleFavoriteButton: Locator;
    readonly createNewChannelMenuItem: Locator;

    constructor(container: Locator) {
        super(container);

        this.teamMenuButton = container.locator('#sidebarTeamMenuButton');
        this.browseOrCreateChannelButton = container.locator('#browseOrAddChannelMenuButton');
        this.findChannelButton = container.getByRole('button', {
            name: en['sidebar_left.channel_navigator.channelSwitcherLabel'],
        });
        this.scheduledPostBadge = container.getByTestId('scheduledPostBadge');
        this.unreadChannelFilter = container.getByRole('link', {
            name: en['sidebar_left.channel_filter.filterUnreadAria'],
        });
        this.openDirectMessageButton = container.getByRole('button', {name: en['sidebar.createDirectMessage']});
        this.toggleFavoriteButton = container.locator('#toggleFavorite');
        this.createNewChannelMenuItem = container.locator('#createNewChannelMenuItem');
    }

    get sidebarCategoryMenu(): Locator {
        return this.container
            .page()
            .getByRole('menu', {name: en['sidebar_left.sidebar_category_menu.dropdownAriaLabel']});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getSidebarItem(channelName: string): Locator {
        return this.container.locator(`#sidebarItem_${channelName}`);
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
        const draftSidebarLink = this.container.getByText(en['drafts.sidebarLink'], {exact: true});
        await draftSidebarLink.waitFor();
        await expect(draftSidebarLink).toBeVisible();
    }

    /**
     * Verifies 'Drafts' as a sidebar link does not exist in LHS.
     */
    async draftsNotVisible() {
        const channel = this.container.getByText(en['drafts.sidebarLink'], {exact: true});
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
        return this.container.locator('[class~="SidebarLink"][class~="unread-title"]');
    }

    getSidebarGroupByName(name: string): Locator {
        return this.container.getByTestId('sidebarChannelGroup').filter({hasText: name});
    }

    getPublicChannelIcon(sidebarItem: Locator): Locator {
        return sidebarItem.getByTestId('publicChannelIcon');
    }

    getPrivateChannelIcon(sidebarItem: Locator): Locator {
        return sidebarItem.getByTestId('privateChannelIcon');
    }

    categoryByName(name: string): Locator {
        return this.container.getByTestId('sidebarChannelGroup').filter({hasText: name});
    }

    categoryContextMenu(name: string): Locator {
        return this.categoryByName(name).getByRole('button', {
            name: en['sidebar_left.sidebar_category_menu.dropdownAriaLabel'],
        });
    }

    get createCategoryButton(): Locator {
        return this.container.getByRole('button', {
            name: en['sidebarLeft.browserOrCreateChannelMenu.createCategoryMenuItem.primaryLabel'],
        });
    }
}
