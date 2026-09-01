// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export default class ChannelBookmarksBar {
    readonly container: Locator;

    readonly addBookmarkButton;
    readonly addLinkMenuItem;
    readonly attachFileMenuItem;
    readonly editMenuItem;
    readonly openMenuItem;
    readonly copyLinkMenuItem;
    readonly deleteMenuItem;
    readonly deleteDialog;
    readonly confirmDeleteButton;

    constructor(container: Locator) {
        this.container = container;
        const page = container.page();

        this.addBookmarkButton = container.getByRole('button', {name: 'Add a bookmark'});
        this.addLinkMenuItem = page.getByRole('menuitem', {name: 'Add a link'});
        this.attachFileMenuItem = page.getByRole('menuitem', {name: 'Attach a file'});
        this.editMenuItem = page.getByRole('menuitem', {name: 'Edit'});
        this.openMenuItem = page.getByRole('menuitem', {name: 'Open'});
        this.copyLinkMenuItem = page.getByRole('menuitem', {name: 'Copy link'});
        this.deleteMenuItem = page.getByRole('menuitem', {name: 'Delete'});
        this.deleteDialog = page.getByRole('dialog', {name: 'Delete bookmark'});
        this.confirmDeleteButton = this.deleteDialog.getByRole('button', {name: 'Yes, delete'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    getBookmark(name: string | RegExp): Locator {
        return this.container.getByRole('link', {name, exact: typeof name === 'string'});
    }

    getBookmarkLinks(): Locator {
        return this.container.getByRole('link');
    }

    getBookmarkItem(name: string | RegExp): Locator {
        return this.container.getByTestId(/^bookmark-item-/).filter({hasText: name});
    }

    getBookmarkIcon(name: string | RegExp): Locator {
        return this.getBookmarkItem(name).getByTestId('bookmark-icon');
    }

    async openAddMenu() {
        await this.addBookmarkButton.click();
        await expect(this.addLinkMenuItem).toBeVisible();
    }

    async openBookmarkMenu(name: string | RegExp) {
        const item = this.getBookmarkItem(name);
        await item.hover();
        await item.getByRole('button', {name: 'Bookmark menu'}).click();
        await expect(this.openMenuItem).toBeVisible();
    }

    getOverflowButton(): Locator {
        return this.container.getByRole('button', {name: /more bookmarks?/});
    }
}
