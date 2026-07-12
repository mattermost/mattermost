// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify archived channels allow opening/copying bookmarks but prevent add, edit, delete, and reorder.
 */
test('MM-T5725 prevents bookmark management in an archived channel', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archived ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'First link', 'https://example.com/first');
    await createLinkBookmark(userClient, channel.id, 'Second link', 'https://example.com/second');

    // # Archive a channel containing two bookmarks
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.archiveChannel();

    // * Verify bookmark management controls are unavailable
    await expect(channelsPage.channelBookmarksBar.addBookmarkButton).not.toBeVisible();
    await channelsPage.channelBookmarksBar.openBookmarkMenu('First link');
    await expect(channelsPage.channelBookmarksBar.openMenuItem).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.copyLinkMenuItem).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.editMenuItem).not.toBeVisible();
    await expect(channelsPage.channelBookmarksBar.deleteMenuItem).not.toBeVisible();
    await page.keyboard.press('Escape');

    const firstLink = channelsPage.channelBookmarksBar.getBookmark('First link');
    await firstLink.focus();
    await firstLink.press('Space');
    await firstLink.press('ArrowRight');
    await firstLink.press('Space');
    await expect(channelsPage.channelBookmarksBar.getBookmark('First link')).toHaveAttribute(
        'href',
        /^https:\/\/example\.com\/first/,
    );
});
