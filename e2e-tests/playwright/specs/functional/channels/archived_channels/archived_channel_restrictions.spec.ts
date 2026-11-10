// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that after archiving a channel, neither the center message box nor the RHS reply box is available.
 */
test('MM-T1716 hides center and RHS message boxes in an archived channel', {tag: '@channels'}, async ({pw}) => {
    // # Create and log in as a test user, then open a new channel
    const {user, team, adminClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Archive Read Only');
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Post a message and open its thread in the RHS
    await channelsPage.postMessage('Test archive reply');
    const post = await channelsPage.getLastPost();
    const postId = await post.getId();
    await post.reply();

    // * Verify the RHS and its reply box are visible before archiving
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.sidebarRight.postCreate.input).toBeVisible();

    // # Archive the channel
    await channelsPage.archiveChannel();

    // * Verify the center message box is no longer available
    await expect(channelsPage.centerView.postCreate.input).not.toBeVisible();

    // * Verify the RHS is closed after archiving
    await expect(channelsPage.sidebarRight.container).not.toBeVisible();

    // # Re-open the thread from the archived post (the last post is now the archive system message)
    const archivedPost = await channelsPage.centerView.getPostById(postId);
    await archivedPost.reply();

    // * Verify the RHS reopens but the reply box is not available
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.sidebarRight.postCreate.input).not.toBeVisible();
});

/**
 * @objective Verify that opening the reply thread of a saved post from an archived channel does not offer a reply box.
 */
test('MM-T1722 opens a saved post from an archived channel without a reply box', {tag: '@channels'}, async ({pw}) => {
    // # Create and log in as a test user, and prepare a channel they belong to
    const {user, team, adminClient, userClient} = await pw.initSetup();
    const message = `Archived saved post ${pw.random.id()}`;
    const channel = await adminClient.createPublicChannel(team.id, 'Archive Saved');
    await adminClient.addToChannel(user.id, channel.id);

    // # Post a message in the channel, then archive the channel
    const post = await adminClient.createPost({channel_id: channel.id, message});
    await adminClient.deleteChannel(channel.id);

    // # Save the post for the test user
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'flagged_post', name: post.id, value: 'true'},
    ]);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open the Saved messages panel
    await channelsPage.globalHeader.openSavedMessages();

    // * Verify the saved post from the archived channel is listed
    await channelsPage.searchResultsPanel.toBeVisible();
    await channelsPage.searchResultsPanel.toContainText(message);

    // # Click the reply arrow on the saved post
    await channelsPage.searchResultsPanel.replyToResultWithText(message);

    // * Verify the thread opens without a reply box because the channel is archived
    await channelsPage.sidebarRight.toBeVisible();
    await expect(channelsPage.sidebarRight.postCreate.input).not.toBeVisible();
});
