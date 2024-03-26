// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, Locator} from '@playwright/test';

export default class PostDotMenu {
    readonly container: Locator;

    readonly replyMenuItem;
    readonly forwardMenuItem;
    readonly followMessageMenuItem;
    readonly markAsUnreadMenuItem;
    readonly remindMenuItem;
    readonly saveMenuItem;
    readonly removeFromSavedMenuItem;
    readonly pinToChannelMenuItem;
    readonly unpinFromChannelMenuItem;
    readonly copyLinkMenuItem;
    readonly editMenuItem;
    readonly copyTextMenuItem;
    readonly deleteMenuItem;

    constructor(container: Locator) {
        this.container = container;

        const getMenuItem = (hasText: string) => container.getByRole('menuitem').filter({hasText});

        this.replyMenuItem = getMenuItem('Reply');
        this.forwardMenuItem = getMenuItem('Forward');
        this.followMessageMenuItem = getMenuItem('Follow message');
        this.markAsUnreadMenuItem = getMenuItem('Mark as Unread');
        this.remindMenuItem = getMenuItem('Remind');
        this.saveMenuItem = getMenuItem('Save');
        this.removeFromSavedMenuItem = getMenuItem('Remove from Saved');
        this.pinToChannelMenuItem = getMenuItem('Pin to Channel');
        this.unpinFromChannelMenuItem = getMenuItem('Unpin from Channel');
        this.copyLinkMenuItem = getMenuItem('Copy Link');
        this.editMenuItem = getMenuItem('Edit');
        this.copyTextMenuItem = getMenuItem('Copy Text');
        this.deleteMenuItem = getMenuItem('Delete');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

export {PostDotMenu};
