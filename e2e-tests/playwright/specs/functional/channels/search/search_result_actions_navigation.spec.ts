// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a full username containing '-' or '_' is shown as a mention link in the mentioned user's search results.
 */
test('MM-T348 shows a full special-character username as a link in search results', {tag: '@search'}, async ({pw}) => {
    // # Create a user whose username contains '-' and '_', plus a user who mentions them
    const {user: mentioningUser, team, adminClient, userClient} = await pw.initSetup();
    const [specialUser] = await adminClient.createUsers(team.id, 1, 'test-user_');
    const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
    await adminClient.addToChannel(specialUser.id, townSquare.id);

    // # The first user posts a message mentioning the special-character username
    const token = `mention${pw.random.id()}`;
    await userClient.createPost({
        channel_id: townSquare.id,
        message: `@${specialUser.username} ${token}`,
        user_id: mentioningUser.id,
    });

    // # Log in as the mentioned user and open Recent Mentions
    const {channelsPage} = await pw.testBrowser.login(specialUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.globalHeader.openRecentMentions();

    // * Verify the mention shows the full username as a clickable mention (rendered as a button)
    await channelsPage.searchResultsPanel.toBeVisible();
    const result = channelsPage.searchResultsPanel.getResultByText(token);
    await expect(result.getByRole('button', {name: `@${specialUser.username}`})).toBeVisible();
});

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
