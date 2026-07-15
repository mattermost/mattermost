// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify reaction actions are unavailable on archived-channel posts in the center, thread, and search views.
 */
test('MM-T1718 hides reaction actions for archived channel posts', {tag: '@channels'}, async ({pw}) => {
    // # Create a channel containing the test user
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive Actions ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    // # Log in and post a uniquely searchable message
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const message = `Test archive reaction ${pw.random.id()}`;
    await channelsPage.postMessage(message);
    const post = await channelsPage.getLastPost();
    const postId = await post.getId();

    // * Verify the reaction action is available before the channel is archived
    await post.hover();
    await expect(post.postMenu.addReactionButton).toBeVisible();

    // # Archive the channel
    await channelsPage.archiveChannel();

    // * Verify the reaction action is unavailable on the center-channel post
    const archivedPost = await channelsPage.centerView.getPostById(postId);
    await archivedPost.hover();
    await expect(archivedPost.postMenu.addReactionButton).toHaveCount(0);

    // # Open the archived post's thread
    await archivedPost.reply();
    const rhsPost = await channelsPage.sidebarRight.getPostById(postId);
    await rhsPost.hover();

    // * Verify the reaction action is unavailable in the thread
    await expect(rhsPost.postMenu.addReactionButton).toHaveCount(0);

    // # Search for the archived post and reveal its post actions
    await channelsPage.searchFor(message);
    const searchResult = channelsPage.searchResultsPanel.getResultByText(message).first();
    await searchResult.hover();

    // * Verify the reaction action is unavailable in search results
    await expect(channelsPage.searchResultsPanel.getAddReactionButton(message)).toHaveCount(0);
});

/**
 * @objective Verify an existing reaction cannot be incremented from the center or thread view after archiving.
 */
test('MM-T1720 cannot add to existing reactions in an archived channel', {tag: '@channels'}, async ({pw}) => {
    // # Create a channel containing the test user
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, `Archive Reaction ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    // # Log in, post a message, and add a reaction through the emoji picker
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('Test add reaction in archive channels');
    const post = await channelsPage.getLastPost();
    const postId = await post.getId();
    await post.openReactionPicker();
    await channelsPage.reactionEmojiPicker.searchEmoji('slightly_frowning_face');
    await channelsPage.reactionEmojiPicker.clickEmoji('slightly frowning face');

    // * Verify the reaction count is one and another reaction can be added
    await post.toHaveReactionCount('slightly_frowning_face', 1);
    await expect(post.postMenu.addReactionButton).toHaveCount(1);

    // # Archive the channel and click the existing reaction
    await channelsPage.archiveChannel();
    const archivedPost = await channelsPage.centerView.getPostById(postId);
    const archivedReaction = archivedPost.getReaction('slightly_frowning_face');
    await archivedReaction.click();

    // * Verify adding reactions is unavailable and the existing count remains one
    await expect(archivedPost.postMenu.addReactionButton).toHaveCount(0);
    await archivedPost.toHaveReactionCount('slightly_frowning_face', 1);

    // # Open the archived post's thread and click its existing reaction
    await archivedPost.reply();
    const rhsPost = await channelsPage.sidebarRight.getPostById(postId);
    const rhsReaction = rhsPost.getReaction('slightly_frowning_face');
    await rhsReaction.click();

    // * Verify the thread cannot add reactions and its existing count remains one
    await expect(rhsPost.postMenu.addReactionButton).toHaveCount(0);
    await rhsPost.toHaveReactionCount('slightly_frowning_face', 1);
});
