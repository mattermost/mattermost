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
