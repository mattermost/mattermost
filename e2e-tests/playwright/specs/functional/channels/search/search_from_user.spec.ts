// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the "from:" search modifier autocompletes a username and returns that user's posts.
 */
test('MM-T377 completes a from: user search from the autocomplete', {tag: '@search'}, async ({pw}) => {
    // # Create the test user plus another user who authors a post
    const {user, team, adminClient} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'author');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(author.id, townSquare.id);

    const token = `fromsearch${pw.random.id()}`;
    const {client: authorClient} = await pw.makeClient(author);
    await authorClient.createPost({channel_id: townSquare.id, message: token});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open search and type the from: modifier
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.toBeVisible();
    const {searchInput} = channelsPage.searchBox;
    await searchInput.fill('from:');

    // # Select the author from the autocomplete suggestions
    await channelsPage.searchBox.container.getByText(author.username, {exact: false}).first().click();

    // * Verify the username is placed into the query without the leading @
    expect(await searchInput.inputValue()).toContain(`from:${author.username}`);

    // # Submit the search
    await searchInput.press('Enter');

    // * Verify the author's post is returned in the results
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(token);
});
