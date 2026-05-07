// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that users can edit a message that has an attachment,
 * the attachment is preserved after edit, and the edited indicator appears.
 */
test('MM-T2268 Edit Message with Attachment', async ({pw}) => {
    // # Initialize user and login
    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    // # Navigate to channels page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message with an attachment
    await channelsPage.postMessage('Test', ['mattermost.png']);

    // # Get the last post and verify content
    const post = await channelsPage.getLastPost();
    await post.toBeVisible();

    // * Verify the posted message is correct
    await post.toContainText('Test');

    // * Verify attachment exists (image thumbnail)
    const attachment = post.container.getByLabel(/file thumbnail/i);
    await expect(attachment).toBeVisible();

    // * Verify edited indicator does not exist initially
    const postId = await post.getId();
    await expect(channelsPage.centerView.editedPostIcon(postId)).not.toBeVisible();

    // # Focus on the post textbox and press Up arrow to open edit dialog
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');

    // # Verify edit mode is active and add more text
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.input.fill('Test with some edit');
    await channelsPage.centerView.postEdit.sendMessage();

    // # Get the updated post
    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();

    // * Verify the new text shows
    await updatedPost.toContainText('Test with some edit');

    // * Verify attachment still exists (image thumbnail)
    const updatedAttachment = updatedPost.container.getByLabel(/file thumbnail/i);
    await expect(updatedAttachment).toBeVisible();

    // * Verify edited indicator now exists
    await expect(channelsPage.centerView.editedPostIcon(postId)).toBeVisible();
});
