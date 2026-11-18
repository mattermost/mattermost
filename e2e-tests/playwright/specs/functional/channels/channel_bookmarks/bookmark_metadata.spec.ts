// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that entering a link in the bookmark create modal auto-fills the bookmark title from the
 * link.
 */
test('MM-T5604 auto-fills the bookmark title from the entered link', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();

    // # Open the bookmark create modal via the channel menu's Bookmarks Bar submenu
    const bookmarks = app.channelHeader.menu.bookmarks;
    await app.channelHeader.openMenuButton.clickTo(bookmarks.container);
    await bookmarks.container.hover();
    await expect(bookmarks.addLinkMenuItem).toBeVisible();
    await bookmarks.addLinkMenuItem.clickTo(app.bookmarkModal);

    // # Enter a link
    await app.bookmarkModal.link.container.fill('https://www.amazon.com');

    // * Verify the title field is auto-filled from the link
    await expect(app.bookmarkModal.title.container).toHaveValue(/amazon/i);

    // # Cancel without saving
    await app.bookmarkModal.cancelButton.click();
    await expect(app.bookmarkModal).not.toBeVisible();
});
