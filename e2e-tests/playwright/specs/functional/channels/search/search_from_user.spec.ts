// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the "from:" search modifier autocompletes a username and returns that user's posts.
 *
 * MM-T376 covers the same from:user autocomplete behavior and is covered by this test.
 */
test('MM-T376 MM-T377 completes a from: user search from the autocomplete', {tag: ['@search']}, async ({pw}) => {
    // # Create the test user plus another user who authors a post
    const {user, team, adminClient, townSquare} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'author');
    await adminClient.addToChannel(author.id, townSquare.id);

    const token = `fromsearch${pw.random.id()}`;
    const post = await pw.postAs(author, {channel_id: townSquare.id, message: token});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    const input = app.searchBox.inputSearchbox;

    // # Open search, type the from: modifier, and select the author from the autocomplete
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await input.fill('from:');
    await app.searchBox.suggestions.suggestion(author.username).select();

    // * Verify the username is placed into the query without the leading @
    await expect(input).toHaveValue(new RegExp(`from:${author.username}`));

    // # Submit the search
    await input.press('Enter');

    // * Verify the author's post is returned in the results
    await expect(app.search.results.post(post)).toBeVisible();
});
