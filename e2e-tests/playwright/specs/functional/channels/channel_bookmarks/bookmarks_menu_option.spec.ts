// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
