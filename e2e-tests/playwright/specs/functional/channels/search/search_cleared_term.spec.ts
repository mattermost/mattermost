// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a cleared search term stays cleared after the search results panel is closed.
 */
test('MM-T352 keeps a cleared search term empty after closing search results', {tag: '@search'}, async ({pw}) => {
    // # Create a user with a searchable post and open the channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const term = `London${pw.random.id()}`;
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message: term});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Search for the post, reopen search, and clear the query
    await channelsPage.searchFor(term);
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();

    // * Verify the query is empty while the search results remain open
    await expect(channelsPage.searchBox.searchInput).toHaveValue('');
    await channelsPage.searchResultsPanel.toBeVisible();

    // # Close both search surfaces, then open search again
    await channelsPage.searchBox.searchBoxClose.click();
    await channelsPage.sidebarRight.close();
    await channelsPage.globalHeader.openSearch();

    // * Verify the cleared term does not reappear
    await expect(channelsPage.searchBox.searchInput).toHaveValue('');
});
