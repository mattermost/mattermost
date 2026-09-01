// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import type {Client4} from '@mattermost/client';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Page} from '@playwright/test';

import type {ChannelsPage} from '@mattermost/playwright-lib';

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

export async function addFileBookmark(page: Page, channelsPage: ChannelsPage, fileName = 'sample_text_file.txt') {
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openBookmarksSubmenu();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await channelMenu.addBookmarkFile.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('asset', fileName));
    await channelsPage.bookmarkCreateModal.toBeVisible();
    await channelsPage.bookmarkCreateModal.addButton.click();
}
