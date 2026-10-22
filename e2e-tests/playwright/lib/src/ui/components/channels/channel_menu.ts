// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * The channel header dropdown menu, opened from the channel name at the top of the center channel.
 * Its accessible name is "<channel> Channel Menu", so it is located by role with a name matcher.
 */
export default class ChannelMenu {
    readonly container: Locator;

    readonly openInNewWindow: Locator;
    readonly viewInfo: Locator;
    readonly muteToggle: Locator;
    readonly notificationPreferences: Locator;
    readonly channelSettings: Locator;
    readonly bookmarksBar: Locator;
    readonly addBookmarkLink: Locator;
    readonly addBookmarkFile: Locator;
    readonly members: Locator;
    readonly moveTo: Locator;
    readonly leaveChannel: Locator;
    readonly archiveToggle: Locator;
    readonly closeConversation: Locator;
    readonly settings: Locator;
    readonly editHeader: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.openInNewWindow = this.item('Open in new window');
        this.viewInfo = this.item('View Info');
        this.muteToggle = this.item(/^(Mute|Unmute)( Channel)?$/);
        this.notificationPreferences = this.item('Notification Preferences');
        this.channelSettings = this.item('Channel Settings');
        this.bookmarksBar = this.item('Bookmarks Bar');

        // The Bookmarks Bar submenu items render in a portal outside this menu's container.
        this.addBookmarkLink = container.page().getByRole('menuitem', {name: 'Add a link'});
        this.addBookmarkFile = container.page().getByRole('menuitem', {name: 'Attach a file'});
        this.members = this.item('Members');
        this.moveTo = this.item('Move to...');
        this.leaveChannel = this.item('Leave Channel');
        this.archiveToggle = this.item(/^(Archive|Unarchive) Channel$/);
        this.closeConversation = this.item(/^Close (Direct Message|Group Message|Conversation)$/);
        this.settings = this.item('Settings');
        this.editHeader = container.page().getByRole('menuitem', {name: 'Edit Header'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    /**
     * Locates a menu item by its accessible name.
     */
    item(name: string | RegExp): Locator {
        return this.container.getByRole('menuitem', {name});
    }

    /**
     * Opens the "Bookmarks Bar" submenu by hovering its parent item.
     */
    async openBookmarksSubmenu() {
        await this.bookmarksBar.hover();
        await expect(this.addBookmarkLink).toBeVisible();
    }

    async openEditHeader() {
        await this.settings.hover();
        await expect(this.editHeader).toBeVisible();
        await this.editHeader.click();
    }
}
