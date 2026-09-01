// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that entering a link in the bookmark create modal auto-fills the bookmark title from the
 * link.
 */
test('MM-T5604 auto-fills the bookmark title from the entered link', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the bookmark create modal via the channel menu's Bookmarks Bar submenu
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openBookmarksSubmenu();
    await channelMenu.addBookmarkLink.click();
    await channelsPage.bookmarkCreateModal.toBeVisible();

    // # Enter a link
    await channelsPage.bookmarkCreateModal.linkInput.fill('https://www.amazon.com');

    // * Verify the title field is auto-filled from the link
    await expect(channelsPage.bookmarkCreateModal.titleInput).toHaveValue(/amazon/i);

    // # Cancel without saving
    await channelsPage.bookmarkCreateModal.cancelButton.click();
    await channelsPage.bookmarkCreateModal.notToBeVisible();
});
