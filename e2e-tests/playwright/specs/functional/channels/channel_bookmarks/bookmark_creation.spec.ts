// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that on a licensed server the Bookmarks Bar option is available in the channel menu with
 * an "Add a link" action, even when the channel has no bookmarks yet.
 *
 * MM-T5601 covers the same behavior as MM-T5600 and is covered by this test.
 */
test('MM-T5600 MM-T5601 shows the Bookmarks Bar option in the channel menu', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the channel menu
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);

    // * Verify the Bookmarks Bar option is available
    await expect(bookmarks.container).toBeVisible();

    // # Open the Bookmarks Bar submenu
    await bookmarks.container.hover();

    // * Verify the "Add a link" action is available
    await expect(bookmarks.addLinkMenuItem).toBeVisible();
});

/**
 * @objective Verify a user can add a link bookmark from the channel menu's Bookmarks Bar submenu and see it
 * in the channel bookmarks bar.
 */
test('MM-T5602 adds a link bookmark to the channel bookmarks bar', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the Bookmarks Bar submenu from the channel menu and choose "Add a link"
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);
    await bookmarks.container.hover();
    await expect(bookmarks.addLinkMenuItem).toBeVisible();
    await bookmarks.addLinkMenuItem.clickTo(app.bookmarkModal);

    // # Enter a link and add the bookmark
    await app.bookmarkModal.link.container.fill('https://www.mattermost.com');
    const created = await settle(app.bookmarkModal.confirmButton, {wait: Api.CreateChannelBookmark}).click();

    // * Verify the bookmark appears in the channel bookmarks bar
    await expect(app.channelBookmarks).toBeVisible();
    await expect(app.channelBookmarks.bookmark(created)).toContainText(/mattermost/i);
});

/**
 * @objective Verify a user can add a file bookmark from the channel menu's Bookmarks Bar submenu and see it
 * in the channel bookmarks bar.
 */
test('MM-T5603 adds a file bookmark to the channel bookmarks bar', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the Bookmarks Bar submenu and choose "Attach a file", selecting a file
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);
    await bookmarks.container.hover();
    await expect(bookmarks.attachFileMenuItem).toBeVisible();
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), bookmarks.attachFileMenuItem.click()]);
    await fileChooser.setFiles(path.resolve('asset/mattermost-icon_128x128.png'));

    // # Confirm the file bookmark
    await expect(app.bookmarkModal).toBeVisible();
    const created = await settle(app.bookmarkModal.confirmButton, {wait: Api.CreateChannelBookmark}).click();

    // * Verify the file bookmark appears in the channel bookmarks bar
    await expect(app.channelBookmarks).toBeVisible();
    await expect(app.channelBookmarks.bookmark(created)).toContainText(/mattermost-icon/i);
});
