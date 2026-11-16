// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can reply to a post from search results and see the reply in the opened thread.
 */
test('MM-T373 replies to a post from search results', {tag: '@search'}, async ({pw}) => {
    // # Create a uniquely searchable post and open its channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const message = `asparagus${pw.random.id()}`;
    await adminClient.createPost({channel_id: channel.id, user_id: user.id, message});

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Search for the post and open its reply thread from the result
    await channelsPage.searchFor(message);
    await expect(channelsPage.searchResultsPanel.getResultByText(message)).toBeVisible();
    await channelsPage.searchResultsPanel.replyToResultWithText(message);
    await channelsPage.sidebarRight.toBeVisible();

    // # Post a reply in the opened thread
    const comment = `Replying to asparagus ${pw.random.id()}`;
    await channelsPage.sidebarRight.postMessage(comment);

    // * Verify the original post and new reply remain visible in the thread
    await (await channelsPage.sidebarRight.getFirstPost()).toContainText(message);
    await (await channelsPage.sidebarRight.getLastPost()).toContainText(comment);
});
