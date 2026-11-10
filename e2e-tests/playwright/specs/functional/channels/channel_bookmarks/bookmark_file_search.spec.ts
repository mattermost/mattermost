// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type ChannelsPage} from '@mattermost/playwright-lib';

import {addFileBookmark} from './support';

const fileName = 'sample_text_file.txt';

async function searchFiles(channelsPage: ChannelsPage) {
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    await channelsPage.searchBox.searchInput.fill(fileName);
    await channelsPage.searchBox.searchInput.press('Enter');
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.filesTab.click();
}

/**
 * @objective Verify a file attached as a bookmark appears in Files search results.
 */
test('MM-T5613 finds a file bookmark in Files search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Search ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    // # Add a file bookmark and search for its filename
    await addFileBookmark(page, channelsPage);

    await searchFiles(channelsPage);

    // * Verify the file bookmark appears in Files results
    await expect(channelsPage.searchResultsPanel.container.getByText(fileName, {exact: true})).toBeVisible();
});

/**
 * @objective Verify deleting a file bookmark removes its file from Files search results.
 */
test('MM-T5614 removes a deleted file bookmark from Files search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Delete ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    // # Add a file bookmark and confirm it is searchable
    await addFileBookmark(page, channelsPage);

    await searchFiles(channelsPage);
    await expect(channelsPage.searchResultsPanel.container.getByText(fileName, {exact: true})).toBeVisible();
    await page.keyboard.press('ControlOrMeta+.');
    await expect(channelsPage.searchResultsPanel.container).not.toBeVisible();

    // # Delete the file bookmark
    await channelsPage.channelBookmarksBar.openBookmarkMenu(fileName);
    await channelsPage.channelBookmarksBar.deleteMenuItem.click();
    await expect(channelsPage.channelBookmarksBar.deleteDialog).toBeVisible();
    await channelsPage.channelBookmarksBar.confirmDeleteButton.click();

    // * Verify the deleted file no longer appears in Files results
    await searchFiles(channelsPage);
    await expect(channelsPage.searchResultsPanel.container.getByText(fileName, {exact: true})).not.toBeVisible();
});
