// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the search box shows help text when opened from the channel and again after opening a thread.
 */
test('MM-T370 shows search help text when the search box is opened', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message and open its thread
    await channelsPage.postMessage(`help text ${pw.random.id()}`);

    // # Open the search box
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();

    // * Verify the search help text is shown
    await expect(channelsPage.page.getByText('Filter your search with:')).toBeVisible();

    // # Close the search box, then open a thread
    await channelsPage.page.keyboard.press('Escape');
    await expect(channelsPage.searchBox.container).not.toBeVisible();
    const post = await channelsPage.getLastPost();
    await post.reply();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();

    // * Verify the search help text is shown again
    await expect(channelsPage.page.getByText('Filter your search with:')).toBeVisible();
});
