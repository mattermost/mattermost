// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clearing a completed search displays search options without removing the existing results.
 */
test('MM-T353 displays search options after clearing the query', {tag: '@search'}, async ({pw}) => {
    // # Create a user with a searchable post and open the channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'town-square');
    const searchWord = `Hello${pw.random.id()}`;
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message: searchWord});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Search for the post, reopen search, and clear the query
    await channelsPage.searchFor(searchWord);
    await channelsPage.globalHeader.openSearch();
    await expect(channelsPage.searchBox.searchInput).toHaveValue(searchWord);
    await channelsPage.searchBox.clearIfPossible();
    await expect(channelsPage.searchBox.searchInput).toHaveValue('');

    // * Verify search options appear and the existing results remain visible
    await expect(channelsPage.searchBox.searchHints).toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultByText(searchWord)).toBeVisible();

    // # Close and reopen the search box
    await channelsPage.searchBox.searchBoxClose.click();
    await channelsPage.globalHeader.openSearch();

    // * Verify search options are still displayed
    await expect(channelsPage.searchBox.searchHints).toBeVisible();
});
