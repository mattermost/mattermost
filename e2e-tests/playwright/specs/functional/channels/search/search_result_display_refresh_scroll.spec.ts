// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectSearchResult, submitSearch} from './search_result_helpers';

/**
 * @objective Verify message search displays matching results in the right-hand side, rendering markdown
 * content correctly, and that jumping to the conversation and clearing the query keep results intact.
 */
test('MM-T350 Searching displays results in the RHS', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
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
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message});
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const query = `hello ${identifier}`;
    await submitSearch(channelsPage, query);

    // * Verify the matching result appears in the RHS with each markdown element rendered distinctly
    await expectSearchResult(channelsPage, 'Hello world', query);
    const result = channelsPage.getSearchResultItem('Hello world');
    await expect(channelsPage.searchResultsPanel.getResultHeading('Hello world', 'Hello')).toBeVisible();
    await expect(channelsPage.searchResultsPanel.getResultCodeBlock('Hello world')).toContainText('Hello');
    await expect(result).toContainText('#hello');

    // # Jump to the conversation from the search result
    await channelsPage.searchResultsPanel.jumpToResultWithText('Hello world');

    // # Reopen search and clear the query text
    await channelsPage.globalHeader.openSearch();
    await channelsPage.searchBox.clearIfPossible();

    // * Verify the search results remain visible after clearing the query text
    await expect(channelsPage.searchResultsContainer).toBeVisible();
});

/**
 * @objective Verify that a new search replaces the previous results instead of combining them.
 */
test('MM-T355 replaces old search results with new results', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    const helloToken = `hello${pw.random.id()}`;
    const writingToken = `writing${pw.random.id()}`;

    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message in Town Square and search for it
    await channelsPage.postMessage(`${helloToken} there everyone`);
    await channelsPage.searchFor(helloToken);

    // * Verify the first message is shown in the results
    await channelsPage.searchResultsPanel.toContainText(helloToken);

    // # Post a different message in another channel and run a new search for it
    await channelsPage.sidebarLeft.goToItem('off-topic');
    await channelsPage.postMessage(`${writingToken} to you here`);
    await channelsPage.searchFor(writingToken);

    // * Verify the new results are shown and the old results are gone
    await channelsPage.searchResultsPanel.toContainText(writingToken);
    await expect(channelsPage.searchResultsPanel.getResultByText(helloToken)).toHaveCount(0);
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
    for (let i = 0; i < messageCount; i++) {
        await adminClient.createPost({channel_id: channel.id, message: `${token} ${i}`});
    }

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Search for the matching posts
    await channelsPage.searchFor(token);
    await channelsPage.searchResultsPanel.toBeVisible();
    const resultCountBefore = await channelsPage.searchResultsPanel.getResultItems().count();
    expect(resultCountBefore).toBeGreaterThan(0);

    // # Scroll the center channel up to load older messages
    const box = await channelsPage.centerView.container.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, -1500);
        await pw.wait(pw.duration.half_sec);
    }

    // * Verify the search results panel is still open and its results are unchanged
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(token);
    expect(await channelsPage.searchResultsPanel.getResultItems().count()).toBe(resultCountBefore);
});
