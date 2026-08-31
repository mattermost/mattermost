// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that hashtag search is not case sensitive and returns all case variants of a hashtag.
 */
test('MM-T359 returns all case variants when searching a hashtag', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post the same hashtag word in three different letter cases
    const suffix = pw.random.id();
    const upper = `#CASE${suffix}`;
    const mixed = `#Case${suffix}`;
    const lower = `#case${suffix}`;
    await channelsPage.postMessage(upper);
    await channelsPage.postMessage(mixed);
    await channelsPage.postMessage(lower);

    // # Search for the lowercase hashtag
    await channelsPage.searchFor(lower);

    // * Verify all three case variants are returned (case-sensitive text checks)
    await expect(channelsPage.searchResultsPanel.getResultItems()).toHaveCount(3);
    await expect(channelsPage.searchResultsPanel.container).toContainText(upper);
    await expect(channelsPage.searchResultsPanel.container).toContainText(mixed);
    await expect(channelsPage.searchResultsPanel.container).toContainText(lower);
});

/**
 * @objective Verify that clicking a hashtag in a Recent Mentions result runs a hashtag search.
 */
test('MM-T360 searches a hashtag from a recent mention', {tag: '@search'}, async ({pw}) => {
    // # Create the test user plus a second user who will mention them
    const {user, team, adminClient} = await pw.initSetup();
    const [mentioner] = await adminClient.createUsers(team.id, 1, 'mentioner');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(mentioner.id, townSquare.id);

    // # The second user posts a message with a hashtag that mentions the test user
    const hashtag = `#hello${pw.random.id()}`;
    const {client: mentionerClient} = await pw.makeClient(mentioner);
    await mentionerClient.createPost({channel_id: townSquare.id, message: `${hashtag} @${user.username}`});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Recent Mentions
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify the mention with the hashtag is listed
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(hashtag);

    // # Click the hashtag in the mention
    await channelsPage.searchResultsPanel.container.getByRole('link', {name: hashtag}).first().click();

    // * Verify the view navigated to hashtag search results that include the message
    await expect(channelsPage.globalHeader.searchBox).toContainText(hashtag);
    await channelsPage.searchResultsPanel.toContainText(hashtag);
});

/**
 * @objective Verify that clicking a hashtag in a Saved messages result runs a hashtag search.
 */
test('MM-T361 searches a hashtag from a saved message', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and post + save a message with a hashtag
    const {user, team, userClient} = await pw.initSetup();
    const hashtag = `#hello${pw.random.id()}`;
    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const post = await userClient.createPost({channel_id: townSquare.id, message: `${hashtag} World`});
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'flagged_post', name: post.id, value: 'true'},
    ]);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open Saved messages
    await channelsPage.globalHeader.openSavedMessages();

    // * Verify the saved message with the hashtag is listed
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(hashtag);

    // # Click the hashtag in the saved message
    await channelsPage.searchResultsPanel.container.getByRole('link', {name: hashtag}).first().click();

    // * Verify the view navigated to hashtag search results that include the message
    await expect(channelsPage.globalHeader.searchBox).toContainText(hashtag);
    await channelsPage.searchResultsPanel.toContainText(hashtag);
});
