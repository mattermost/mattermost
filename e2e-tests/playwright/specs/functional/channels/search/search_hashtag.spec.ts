// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that hashtag search is not case sensitive and returns all case variants of a hashtag.
 */
test('MM-T359 returns all case variants when searching a hashtag', {tag: ['@search']}, async ({pw}) => {
    // # Post the same hashtag word in three different letter cases
    const {user, team, userClient, townSquare} = await pw.initSetup();
    const suffix = pw.random.id();
    const posts = await Promise.all(
        [`#CASE${suffix}`, `#Case${suffix}`, `#case${suffix}`].map((message) =>
            userClient.createPost({channel_id: townSquare.id, message}),
        ),
    );

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Search for the lowercase hashtag
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(`#case${suffix}`);
    await app.searchBox.inputSearchbox.press('Enter');

    // * Verify the header's search bar shows the search type (the badge search_box_clear_button expects to be gone)
    await expect(app.globalHeader.search.typeBadgeText).toBeVisible();

    // * Verify all three case variants are returned (case-sensitive text checks)
    const results = app.search.results;
    await expect.poll(async () => (await results.postList.keys()).length).toBe(3);
    for (const post of posts) {
        await expect(results.post(post).message.container).toHaveText(post.message);
    }
});

/**
 * @objective Verify that clicking a hashtag in a Recent Mentions result runs a hashtag search.
 */
test('MM-T360 searches a hashtag from a recent mention', {tag: '@search'}, async ({pw}) => {
    // # Create the test user plus a second user who will mention them
    const {user, team, adminClient, townSquare} = await pw.initSetup();
    const [mentioner] = await adminClient.createUsers(team.id, 1, 'mentioner');
    await adminClient.addToChannel(mentioner.id, townSquare.id);

    // # The second user posts a message with a hashtag that mentions the test user
    const hashtag = `#hello${pw.random.id()}`;
    const {client: mentionerClient} = await pw.makeClient(mentioner);
    const post = await mentionerClient.createPost({channel_id: townSquare.id, message: `${hashtag} @${user.username}`});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Recent Mentions
    await app.globalHeader.recentMentionsButton.click();

    // * Verify the mention with the hashtag is listed
    const result = app.search.results.post(post);
    await expect(result.message.container).toContainText(hashtag);

    // # Click the hashtag in the mention
    await result.markdown.hashtagLink.click();

    // * Verify the view navigated to hashtag search results that include the message
    await expect(app.globalHeader.search.openButton).toContainText(hashtag);
    await expect(app.search.results.post(post).message.container).toContainText(hashtag);
});

/**
 * @objective Verify that clicking a hashtag in a Saved messages result runs a hashtag search.
 */
test('MM-T361 searches a hashtag from a saved message', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and post + save a message with a hashtag
    const {user, team, userClient, townSquare} = await pw.initSetup();
    const hashtag = `#hello${pw.random.id()}`;
    const post = await userClient.createPost({channel_id: townSquare.id, message: `${hashtag} World`});
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'flagged_post', name: post.id, value: 'true'},
    ]);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Saved messages
    await app.globalHeader.savedMessagesButton.click();

    // * Verify the saved message with the hashtag is listed
    const result = app.search.results.post(post);
    await expect(result.message.container).toContainText(hashtag);

    // # Click the hashtag in the saved message
    await result.markdown.hashtagLink.click();

    // * Verify the view navigated to hashtag search results that include the message
    await expect(app.globalHeader.search.openButton).toContainText(hashtag);
    await expect(app.search.results.post(post).message.container).toContainText(hashtag);
});
