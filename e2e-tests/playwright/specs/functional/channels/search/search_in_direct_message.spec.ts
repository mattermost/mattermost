// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the "in:" search modifier autocompletes a direct-message user and returns matching DM posts.
 */
test('MM-T358 searches for a message in a direct message channel', {tag: '@search'}, async ({pw}) => {
    // # Create a direct message and a uniquely searchable post
    const {user, team, adminClient} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-user');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    const message = `Hello${pw.random.id()}`;
    await adminClient.createPost({channel_id: dmChannel.id, user_id: user.id, message});
    await adminClient.createPost({channel_id: townSquare.id, user_id: user.id, message});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Type the in: modifier and select the other user from the autocomplete
    await channelsPage.globalHeader.openSearch();
    const {searchInput} = channelsPage.searchBox;
    await searchInput.fill('in:');
    await channelsPage.searchBox.selectSuggestionMatching(`@${otherUser.username}`);

    // * Verify the direct-message user is placed into the query
    await expect(searchInput).toHaveValue(`in:@${otherUser.username} `);

    // # Add the message text and submit the search
    await searchInput.pressSequentially(message);
    await searchInput.press('Enter');
    await channelsPage.searchResultsPanel.toBeVisible();

    // * Verify the matching direct message is returned
    await expect(channelsPage.searchResultsPanel.getResultByText(message)).toHaveCount(1);
});
