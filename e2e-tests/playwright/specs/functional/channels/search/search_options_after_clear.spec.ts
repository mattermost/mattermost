// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clearing a completed search displays search options without removing the existing results.
 */
test('MM-T353 displays search options after clearing the query', {tag: '@search'}, async ({pw}) => {
    // # Create a user with a searchable post and open the channel
    const {user, team, userClient, townSquare: channel} = await pw.initSetup();
    const searchWord = `Hello${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: channel.id, message: searchWord});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const input = app.searchBox.inputSearchbox;

    // # Search for the post, reopen search, and clear the query
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill(searchWord);
    await input.press('Enter');
    await expect(app.search.results.post(post)).toBeVisible();
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await expect(input).toHaveValue(searchWord);
    await app.searchBox.clearButton.click();
    await expect(input).toHaveValue('');

    // * The search options appear, and the existing result stays
    await expect(app.searchBox.hints).toBeVisible();
    await expect(app.search.results.post(post)).toBeVisible();

    // # Close and reopen the search box
    await app.searchBox.closeButton.click();
    await expect(app.searchBox.inputSearchbox).not.toBeVisible();
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);

    // * The search options are still shown
    await expect(app.searchBox.hints).toBeVisible();
});
