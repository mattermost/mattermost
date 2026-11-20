// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, type App} from '@mattermost/playwright-lib';

import {addFileBookmark} from './support';

const fileName = 'sample_text_file.txt';

async function searchFiles(app: App) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(fileName);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.search.panel).toBeVisible();
    await app.search.tabs.filesTab.select();
    await expect(app.search.tabs.filesTab).toHaveAttribute('aria-selected', 'true');
}

/**
 * @objective Verify a file attached as a bookmark appears in Files search results.
 */
test('MM-T5613 finds a file bookmark in Files search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Search ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    // # Add a file bookmark and search for its filename
    const {fileId} = await addFileBookmark(page, app);

    await searchFiles(app);

    // * Verify the file bookmark appears in Files results
    await expect(app.search.results.file(fileId)).toContainText(fileName);
});

/**
 * @objective Verify deleting a file bookmark removes its file from Files search results.
 */
test('MM-T5614 removes a deleted file bookmark from Files search results', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Delete ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channel.name});
    // # Add a file bookmark and confirm it is searchable
    const {bookmark, fileId} = await addFileBookmark(page, app);

    await searchFiles(app);
    await expect(app.search.results.file(fileId)).toContainText(fileName);
    await page.keyboard.press('ControlOrMeta+.');
    await expect(app.search.panel).not.toBeVisible();

    // # Delete the file bookmark
    const item = app.channelBookmarks.bookmark(bookmark);
    await item.container.hover();
    await item.openMenuButton.clickTo(app.bookmarkMenu.deleteMenuItem);
    const deleteModal = await app.bookmarkMenu.deleteMenuItem.clickTo(app.bookmarkDeleteModal);
    await settle(deleteModal.confirmButton, {wait: Api.DeleteChannelBookmark}).click();
    await expect(item.container).not.toBeVisible();

    // * Verify the deleted file no longer appears in Files results
    await searchFiles(app);
    await expect(app.search.results.file(fileId)).not.toBeVisible();
});
