// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that jumping from a search result opens a post that is not already displayed in the center channel.
 */
test('MM-T380 jumps from a search result to a post in another channel', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and create a channel with many posts
    const {user, team, adminClient} = await pw.initSetup();
    const linkChannel = await adminClient.createPublicChannel(team.id, 'Link Test', 'link-test');
    await adminClient.addToChannel(user.id, linkChannel.id);

    // # Post a target message surrounded by many other messages so it is not initially loaded elsewhere
    const token = `asparagus${pw.random.id()}`;
    for (let i = 0; i < 4; i++) {
        await adminClient.createPost({channel_id: linkChannel.id, message: `RF Random Post before ${i}`});
    }
    await adminClient.createPost({channel_id: linkChannel.id, message: token});
    for (let i = 0; i < 8; i++) {
        await adminClient.createPost({channel_id: linkChannel.id, message: `RF Random Post after ${i}`});
    }

    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // # Search for the target message from a different channel
    await channelsPage.searchFor(token);
    await channelsPage.searchResultsPanel.toContainText(token);

    // # Jump to the post from the search results
    await channelsPage.searchResultsPanel.jumpToResultWithText(token);

    // * Verify navigation to the target channel and that the target post is displayed in the center
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/channels/${linkChannel.name}`);
    await expect(channelsPage.centerView.container.getByText(token, {exact: true})).toBeVisible();
});
