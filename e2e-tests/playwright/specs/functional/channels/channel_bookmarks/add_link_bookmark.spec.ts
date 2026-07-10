// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
