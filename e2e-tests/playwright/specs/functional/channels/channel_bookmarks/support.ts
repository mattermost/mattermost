// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Page} from '@playwright/test';

import {Api, expect, settle, type App} from '@mattermost/playwright-lib';

export async function createLinkBookmark(
    client: Client4,
    channelId: string,
    displayName: string,
    linkUrl: string,
    options: {emoji?: string; imageUrl?: string} = {},
): Promise<ChannelBookmark> {
    return client.createChannelBookmark(
        channelId,
        {
            display_name: displayName,
            link_url: linkUrl,
            type: 'link',
            emoji: options.emoji,
            image_url: options.imageUrl,
        },
        '',
    );
}

export async function createLinkBookmarks(client: Client4, channelId: string, count: number) {
    const bookmarks: ChannelBookmark[] = [];
    for (let index = 0; index < count; index++) {
        bookmarks.push(
            await createLinkBookmark(
                client,
                channelId,
                `Bookmark ${index + 1}`,
                `https://example.com/bookmark-${index + 1}`,
            ),
        );
    }
    return bookmarks;
}

export async function addFileBookmark(
    page: Page,
    app: App,
    fileName = 'sample_text_file.txt',
): Promise<{bookmark: ChannelBookmark; fileId: string}> {
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);
    await bookmarks.container.hover();
    await expect(bookmarks.attachFileMenuItem).toBeVisible();
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), bookmarks.attachFileMenuItem.click()]);
    await fileChooser.setFiles(path.resolve('asset', fileName));
    await expect(app.bookmarkModal).toBeVisible();
    const bookmark = await settle(app.bookmarkModal.confirmButton, {wait: Api.CreateChannelBookmark}).click();
    if (!bookmark.file_id) {
        throw new Error(`file bookmark ${bookmark.id} has no file_id`);
    }
    return {bookmark, fileId: bookmark.file_id};
}
