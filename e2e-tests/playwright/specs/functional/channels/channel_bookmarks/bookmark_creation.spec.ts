// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that on a licensed server the Bookmarks Bar option is available in the channel menu with
 * an "Add a link" action, even when the channel has no bookmarks yet.
 *
 * MM-T5601 covers the same behavior as MM-T5600 and is covered by this test.
 */
test('MM-T5600 MM-T5601 shows the Bookmarks Bar option in the channel menu', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the channel menu
    const channelMenu = await channelsPage.openChannelMenu();

    // * Verify the Bookmarks Bar option is available
    await expect(channelMenu.bookmarksBar).toBeVisible();

    // # Open the Bookmarks Bar submenu
    await channelMenu.openBookmarksSubmenu();

    // * Verify the "Add a link" action is available
    await expect(channelMenu.addBookmarkLink).toBeVisible();
});

/**
 * @objective Verify a user can add a link bookmark from the channel menu's Bookmarks Bar submenu and see it
 * in the channel bookmarks bar.
 */
test('MM-T5602 adds a link bookmark to the channel bookmarks bar', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Bookmarks Bar submenu from the channel menu and choose "Add a link"
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openBookmarksSubmenu();
    await channelMenu.addBookmarkLink.click();

    // # Enter a link and add the bookmark
    await channelsPage.bookmarkCreateModal.toBeVisible();
    await channelsPage.bookmarkCreateModal.addLink('https://www.mattermost.com');

    // * Verify the bookmark appears in the channel bookmarks bar
    await expect(channelsPage.channelBookmarksBar).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.getByRole('link', {name: /mattermost/i})).toBeVisible();
});

/**
 * @objective Verify a user can add a file bookmark from the channel menu's Bookmarks Bar submenu and see it
 * in the channel bookmarks bar.
 */
test('MM-T5603 adds a file bookmark to the channel bookmarks bar', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Bookmarks Bar submenu and choose "Attach a file", selecting a file
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openBookmarksSubmenu();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await channelMenu.addBookmarkFile.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve('asset/mattermost-icon_128x128.png'));

    // # Confirm the file bookmark
    await channelsPage.bookmarkCreateModal.toBeVisible();
    await channelsPage.bookmarkCreateModal.addButton.click();

    // * Verify the file bookmark appears in the channel bookmarks bar
    await expect(channelsPage.channelBookmarksBar).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.getByText(/mattermost-icon/i)).toBeVisible();
});
