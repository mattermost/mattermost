// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

import en from '@/i18n';
import {BaseComponent} from '@/ui/base_component';

export default class ChannelBookmarks extends BaseComponent {
    readonly addBookmarkButton: Locator;
    readonly addLinkMenuItem: Locator;
    readonly attachFileMenuItem: Locator;

    constructor(container: Locator) {
        super(container);

        this.addBookmarkButton = container.locator('#channelBookmarksBarMenuButton');
        this.addLinkMenuItem = container.locator('#channelBookmarksAddLink');
        this.attachFileMenuItem = container.locator('#channelBookmarksAttachFile');
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    getBookmarkItem(bookmarkId: string): Locator {
        return this.container.getByTestId(`bookmark-item-${bookmarkId}`);
    }

    getOverflowBookmarkItem(bookmarkId: string): Locator {
        return this.container.getByTestId(`overflow-bookmark-item-${bookmarkId}`);
    }

    async openAddBookmarkMenu(): Promise<void> {
        await this.addBookmarkButton.click();
    }

    async clickAddLink(): Promise<void> {
        await this.openAddBookmarkMenu();
        await this.addLinkMenuItem.click();
    }

    async clickAttachFile(): Promise<void> {
        await this.openAddBookmarkMenu();
        await this.attachFileMenuItem.click();
    }

    getBookmarkMenuButton(bookmarkId: string): Locator {
        return this.getBookmarkItem(bookmarkId).getByLabel(en['channel_bookmarks.editBookmarkLabel']);
    }
}
