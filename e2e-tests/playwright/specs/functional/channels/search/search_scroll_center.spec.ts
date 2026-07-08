// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
