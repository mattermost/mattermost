// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that deleting a parent post from the search results removes both the post and its reply.
 */
test('MM-T381 deletes a parent post from the search results', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user, and open a channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Delete Parent', 'delete-parent');
    await adminClient.addToChannel(user.id, channel.id);

    const parentToken = `parentpost${pw.random.id()}`;
    const replyToken = `replypost${pw.random.id()}`;

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Post a message and reply to it, then close the thread
    await channelsPage.postMessage(parentToken);
    const post = await channelsPage.getLastPost();
    await post.reply();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postMessage(replyToken);
    await channelsPage.sidebarRight.close();

    // * Verify both the parent post and its reply are searchable before deletion
    await channelsPage.searchFor(replyToken);
    await expect(channelsPage.searchResultsPanel.getResultByText(replyToken)).toHaveCount(1);
    await channelsPage.searchFor(parentToken);
    await expect(channelsPage.searchResultsPanel.getResultByText(parentToken)).toHaveCount(1);

    // # Delete the parent post from the search result
    await channelsPage.searchResultsPanel.openResultDotMenu(parentToken);
    await channelsPage.postDotMenu.deleteMenuItem.click();
    await channelsPage.deletePostModal.toBeVisible();
    await channelsPage.deletePostModal.confirm();

    // * Verify the deleted parent post is removed from the open search results in real time
    await expect(channelsPage.searchResultsPanel.getResultByText(parentToken)).toHaveCount(0);

    // * Verify the reply was also removed (searching for it returns no results)
    await channelsPage.searchFor(replyToken);
    await expect(channelsPage.searchResultsPanel.getResultByText(replyToken)).toHaveCount(0);
});
