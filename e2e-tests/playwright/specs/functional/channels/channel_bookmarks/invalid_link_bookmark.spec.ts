// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an invalid URL shows an error and cannot be saved as a bookmark.
 */
test('MM-T5608 rejects an invalid bookmark URL', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Invalid ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // # Open Add bookmark and enter invalid URL text
    const channelMenu = await channelsPage.openChannelMenu();
    await channelMenu.openBookmarksSubmenu();
    await channelMenu.addBookmarkLink.click();
    await channelsPage.bookmarkCreateModal.toBeVisible();

    await channelsPage.bookmarkCreateModal.linkInput.fill('this is not a URL');

    // * Verify the validation error appears and saving is disabled
    await expect(channelsPage.bookmarkCreateModal.invalidLinkMessage).toBeVisible();
    await expect(channelsPage.bookmarkCreateModal.addButton).toBeDisabled();
});
