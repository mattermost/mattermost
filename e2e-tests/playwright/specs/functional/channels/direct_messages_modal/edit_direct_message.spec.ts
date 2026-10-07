// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a direct message can be edited and the recipient sees the updated body and edited marker without a mention badge.
 */
test('MM-T449 edits a direct message body', {tag: '@direct_messages'}, async ({pw}) => {
    const originalMessage = 'Hello';
    const editedMessage = 'Hello World';

    // # Create a direct message and send its initial post
    const {user: sender, team, adminClient} = await pw.initSetup();
    const [recipient] = await adminClient.createUsers(team.id, 1, 'dm-edit');
    const {client: senderClient} = await pw.makeClient(sender);
    const dmChannel = await adminClient.createDirectChannel([sender.id, recipient.id]);
    const post = await senderClient.createPost({
        channel_id: dmChannel.id,
        message: originalMessage,
    });

    // # Open the direct message as the recipient
    const {channelsPage: recipientChannelsPage, page: recipientPage} = await pw.testBrowser.login(recipient);
    await recipientChannelsPage.goto(team.name, `@${sender.username}`);
    await recipientChannelsPage.toBeVisible();

    // * Verify the original message is sent and is not pending
    const recipientPost = await recipientChannelsPage.centerView.getPostById(post.id);
    await recipientPost.toContainText(originalMessage);
    await recipientPost.toHaveId(post.id);

    // # Open the direct message as the sender and edit the post with the Up arrow shortcut
    const {channelsPage: senderChannelsPage, page: senderPage} = await pw.testBrowser.login(sender);
    await senderChannelsPage.goto(team.name, `@${recipient.username}`);
    await senderChannelsPage.toBeVisible();
    await senderChannelsPage.centerView.postCreate.input.focus();
    await senderPage.keyboard.press('ArrowUp');
    await senderChannelsPage.centerView.postEdit.toBeVisible();
    await expect(senderChannelsPage.centerView.postEdit.input).toHaveValue(originalMessage);
    await senderChannelsPage.centerView.postEdit.writeMessage(editedMessage);
    await senderChannelsPage.centerView.postEdit.sendMessage();

    // * Verify the sender sees the edited body and marker
    const senderPost = await senderChannelsPage.centerView.getPostById(post.id);
    await senderPost.toContainText(editedMessage);
    await senderPost.toBeEdited();

    // # Reload the recipient's direct message
    await recipientPage.reload();
    await recipientChannelsPage.toBeVisible();

    // * Verify the recipient sees the edit without an unread mention indicator
    const updatedRecipientPost = await recipientChannelsPage.centerView.getPostById(post.id);
    await updatedRecipientPost.toContainText(editedMessage);
    await updatedRecipientPost.toBeEdited();
    await expect(recipientChannelsPage.sidebarLeft.unreadMentionsBadge(sender.username)).not.toBeVisible();
});
