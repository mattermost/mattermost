// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createLinkBookmark} from './support';

/**
 * @objective Verify a bookmark's URL and title can be edited and saved.
 */
test('MM-T5610 edits a bookmark URL and title', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Edit ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);
    await createLinkBookmark(userClient, channel.id, 'Community Server', 'https://community.mattermost.com');

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    const editModal = channelsPage.getBookmarkEditModal();

    // # Open the bookmark editor and change its URL and title
    await channelsPage.channelBookmarksBar.openBookmarkMenu('Community Server');
    await channelsPage.channelBookmarksBar.editMenuItem.click();
    await editModal.toBeVisible();
    await editModal.linkInput.fill('https://hub.mattermost.com');
    await expect(editModal.titleInput).toHaveValue('hub.mattermost.com');
    await expect(editModal.saveButton).toBeEnabled();
    await editModal.titleInput.fill('Hub Server');
    await editModal.saveButton.click();

    // * Verify the updated bookmark title and link
    await expect(channelsPage.channelBookmarksBar.getBookmark('Hub Server')).toBeVisible();
    await expect(channelsPage.channelBookmarksBar.getBookmark('Hub Server')).toHaveAttribute(
        'href',
        /^https:\/\/hub\.mattermost\.com/,
    );
});
