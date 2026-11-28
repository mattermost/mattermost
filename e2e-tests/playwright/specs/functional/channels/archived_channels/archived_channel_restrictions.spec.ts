// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, settle, test, Api} from '@mattermost/playwright-lib';

/**
 * @objective Verify that after archiving a channel, neither the center message box nor the RHS reply box is available.
 */
test('MM-T1716 hides center and RHS message boxes in an archived channel', {tag: '@channels'}, async ({pw}) => {
    // # Create and log in as a test user, then open a new channel
    const {user, team, adminClient, userClient} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Archive Read Only');
    await adminClient.addToChannel(user.id, channel.id);
    const post = await userClient.createPost({channel_id: channel.id, message: 'Test archive reply'});

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Open the post's thread
    const centerPost = app.center.postList.post(post);
    await centerPost.container.hover();
    await centerPost.menu.replyButton.click();

    // * Verify the RHS reply box is available
    await expect(app.rhs.container).toBeVisible();
    await expect(app.rhs.postCreate.message.container).toBeVisible();

    // # Archive the channel
    await app.channelHeader.openMenuButton.clickTo(app.channelHeader.menu.membersMenuItem);
    const archiveModal = await app.channelHeader.menu.archiveChannelMenuItem.clickTo(app.archiveChannelModal);
    await settle(archiveModal.confirmButton, {wait: Api.DeleteChannel}).click();
    await expect(app.center.archivedNotice).toBeVisible();

    // * Verify the center message box is gone and the RHS closed
    await expect(app.center.postCreate.message.container).not.toBeVisible();
    await expect(app.rhs.container).not.toBeVisible();

    // # Open the thread again from the archived post
    await centerPost.container.hover();
    await centerPost.menu.replyButton.click();

    // * Verify the thread opens without a reply box
    await expect(app.rhs.container).toBeVisible();
    await expect(app.rhs.postCreate.message.container).not.toBeVisible();
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

    // # Post a message, archive the channel, and save the post for the user
    const post = await adminClient.createPost({channel_id: channel.id, message});
    await adminClient.deleteChannel(channel.id);
    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'flagged_post', name: post.id, value: 'true'},
    ]);

    const townSquare = await userClient.getChannelByName(team.id, 'town-square');
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open Saved messages
    await app.globalHeader.savedMessagesButton.click();

    // * Verify the saved post is listed
    const result = app.search.results.post(post);
    await expect(result.message.container).toHaveText(message);

    // # Open its thread
    await result.container.hover();
    await result.menu.replyButton.click();

    // * Verify the thread opens without a reply box
    await expect(app.rhs.container).toBeVisible();
    await expect(app.rhs.postCreate.message.container).not.toBeVisible();
});
