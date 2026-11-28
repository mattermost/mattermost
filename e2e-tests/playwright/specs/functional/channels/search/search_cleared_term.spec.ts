// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a cleared search term stays cleared after the search results panel is closed.
 */
test('MM-T352 keeps a cleared search term empty after closing search results', {tag: '@search'}, async ({pw}) => {
    // # Create a user with a searchable post and open the channel
    const {user, team, userClient, offTopic: channel} = await pw.initSetup();
    const term = `London${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: channel.id, message: term});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const input = app.searchBox.inputSearchbox;

    // # Search for the post, reopen search, and clear the query
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill(term);
    await input.press('Enter');
    await expect(app.search.results.post(post)).toBeVisible();
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.clearButton.click();

    // * The query is empty while the search results stay open
    await expect(input).toHaveValue('');
    await expect(app.search.results.post(post)).toBeVisible();

    // # Close the search box and the results, then open search again
    await app.searchBox.closeButton.click();
    await expect(app.searchBox.inputSearchbox).not.toBeVisible();
    await app.search.header.closeButton.click();
    await expect(app.search.header.closeButton).not.toBeVisible();
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);

    // * The cleared term doesn't come back
    await expect(input).toHaveValue('');
});
