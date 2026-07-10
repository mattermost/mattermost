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
    readonly members: Locator;
    readonly moveTo: Locator;
    readonly leaveChannel: Locator;
    readonly archiveToggle: Locator;
    readonly closeConversation: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.openInNewWindow = this.item('Open in new window');
        this.viewInfo = this.item('View Info');
        this.muteToggle = this.item(/^(Mute|Unmute)( Channel)?$/);
        this.notificationPreferences = this.item('Notification Preferences');
        this.channelSettings = this.item('Channel Settings');
        this.bookmarksBar = this.item('Bookmarks Bar');
        this.members = this.item('Members');
        this.moveTo = this.item('Move to...');
        this.leaveChannel = this.item('Leave Channel');
        this.archiveToggle = this.item(/^(Archive|Unarchive) Channel$/);
        this.closeConversation = this.item(/^Close (Direct Message|Group Message|Conversation)$/);
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
}
