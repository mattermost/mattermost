// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {expect, test} from '@mattermost/playwright-lib';

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
