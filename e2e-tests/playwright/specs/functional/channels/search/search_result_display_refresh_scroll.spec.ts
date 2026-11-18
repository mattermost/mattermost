// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {duration, expect, test, type App, Msg} from '@mattermost/playwright-lib';

/**
 * @objective Verify message search displays matching results in the right-hand side, rendering markdown
 * content correctly, and that jumping to the conversation and clearing the query keep results intact.
 */
test('MM-T350 Searching displays results in the RHS', async ({pw}) => {
    const {team, user, offTopic: channel} = await pw.initSetup();
    const identifier = pw.random.id();
    const message = [
        `Basic word search: Hello world! #hello ${identifier}`,
        '',
        '##### Hello',
        '',
        '```',
        'Hello',
        '```',
    ].join('\n');

    // # Create and search for a message with markdown content: a heading, a code block, and a hashtag
    const post = await pw.postAs(user, {channel_id: channel.id, message});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    const query = `hello ${identifier}`;
    await submitSearch(app, query);

    // * Verify the matching result appears in the RHS with each markdown element rendered distinctly
    await expectSearchResult(app, post, query);
    const result = app.search.results.post(post);
    // Rendered markdown has no generated parts; the element's role is what the test checks.
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- markdown renders the heading, which cannot take a test id
    await expect(result.message.container.locator.getByRole('heading', {level: 5})).toContainMessage(
        Msg.user.settings.notifications.desktopNotificationSound.soundHello,
    );
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- markdown renders the code block, which cannot take a test id
    await expect(result.message.container.locator.getByRole('code')).toContainMessage(
        Msg.user.settings.notifications.desktopNotificationSound.soundHello,
    );
    await expect(result.markdown.hashtagLink).toHaveText('#hello');

    // # Jump to the conversation from the search result
    await result.container.hover();
    await result.menu.jumpLink.click();
    await expect(app.center.postList.post(post).message.container).toBeVisible();

    // # Reopen search and clear the query text
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill('');

    // * Verify the search results remain visible after clearing the query text
    await expect(result).toBeVisible();
});

/**
 * @objective Verify that a new search replaces the previous results instead of combining them.
 */
test('MM-T355 replaces old search results with new results', {tag: '@search'}, async ({pw}) => {
    // # Create a message in Town Square and one in Off-Topic
    const {user, team, userClient, townSquare, offTopic} = await pw.initSetup();
    const helloToken = `hello${pw.random.id()}`;
    const writingToken = `writing${pw.random.id()}`;
    const hello = await userClient.createPost({channel_id: townSquare.id, message: `${helloToken} there everyone`});
    const writing = await userClient.createPost({channel_id: offTopic.id, message: `${writingToken} to you here`});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Search for the first message
    await submitSearch(app, helloToken);

    // * Verify the first message is shown in the results
    await expect(app.search.results.postList).toHaveKeys([hello.id]);

    // # Run a new search for the second message from another channel
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    await submitSearch(app, writingToken);

    // * Verify the new results are shown and the old results are gone
    await expect(app.search.results.postList).toHaveKeys([writing.id]);
});

/**
 * @objective Verify that scrolling the center channel while the search results panel is open does not change the results.
 */
test('MM-T382 keeps search results unchanged while scrolling the center channel', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and open a channel with many matching posts
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Search Scroll', 'search-scroll');
    await adminClient.addToChannel(user.id, channel.id);
    const token = `searchfun${pw.random.id()}`;
    const messageCount = 30;
    const first = await adminClient.createPost({channel_id: channel.id, message: `${token} 0`});
    for (let i = 1; i < messageCount; i++) {
        await adminClient.createPost({channel_id: channel.id, message: `${token} ${i}`});
    }

    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Search for the matching posts
    await submitSearch(app, token);
    await expect.poll(async () => (await app.search.results.postList.keys()).length).toBeGreaterThan(0);
    const resultsBefore = await app.search.results.postList.keys();

    // # Scroll the center channel up to load older messages
    await app.center.postList.scroller.hover();
    await expect(async () => {
        await page.mouse.wheel(0, -1500);
        await expect(app.center.postList.post(first)).toBeInViewport({timeout: duration.one_sec});
    }, 'the center channel scrolls up to its first matching post').toPass();

    // * Verify the search results panel is still open and its results are unchanged
    await expect(app.search.results.postList).toHaveKeys(resultsBefore);
    await expect(app.search.results.post({id: resultsBefore[0]}).message.container).toContainText(token);
});

async function submitSearch(app: App, query: string) {
    await app.globalHeader.search.openButton.clickTo(app.searchBox.inputSearchbox);
    await app.searchBox.inputSearchbox.fill(query);
    await app.searchBox.inputSearchbox.press('Enter');
    await expect(app.globalHeader.search.openButton).toContainText(query);
}

/** The post shows in the results; the search is retried while the server indexes it. */
async function expectSearchResult(app: App, post: Post, query: string, timeout = duration.half_min) {
    const result = app.search.results.post(post).locator;
    await expect(async () => {
        await submitSearch(app, query);
        await expect(result).toBeVisible({timeout: duration.one_sec * 5});
    }).toPass({timeout});
}
