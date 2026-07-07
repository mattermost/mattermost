// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that deleting a parent post from the search results removes both the post and its reply.
 */
test('MM-T381 deletes a parent post from the search results', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and open a channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.createChannel(
        pw.random.channel({teamId: team.id, name: 'delete-parent', displayName: 'Delete Parent', type: 'O'}),
    );
    await adminClient.addToChannel(user.id, channel.id);

    const token = `Test message ${pw.random.id()}`;
    const reply = `Replying to ${pw.random.id()}`;

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Post a message and reply to it, then close the thread
    await channelsPage.postMessage(token);
    const post = await channelsPage.getLastPost();
    await post.reply();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postMessage(reply);
    await channelsPage.sidebarRight.close();

    // # Search for the parent post
    await channelsPage.searchFor(token);
    await channelsPage.searchResultsPanel.toContainText(token);

    // * Verify the parent post is present in the results before deletion
    await expect(channelsPage.searchResultsPanel.getResultByText(token)).toHaveCount(1);

    // # Delete the parent post from the search result
    await channelsPage.searchResultsPanel.openResultDotMenu(token);
    await channelsPage.postDotMenu.deleteMenuItem.click();
    await channelsPage.deletePostModal.toBeVisible();
    await channelsPage.deletePostModal.confirm();

    // * Verify the deleted parent post is removed from the open search results in real time
    await expect(channelsPage.searchResultsPanel.getResultByText(token)).toHaveCount(0);
});
