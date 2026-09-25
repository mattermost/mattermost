// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clearing all text while editing a post without attachments prompts for deletion and deletes it.
 */
test('MM-T1271_1 Up deletes a text-only post when its edit is cleared', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const message = `Message to be deleted ${pw.random.id()}`;
    const {user, team} = await pw.initSetup();

    // # Post a message, press Up, and clear its edit
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(message);
    const post = await channelsPage.getLastPost();
    const stablePost = await channelsPage.centerView.getPostById(await post.getId());
    await post.toContainText(message);
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');
    await channelsPage.centerView.postEdit.toBeVisible();
    await expect(channelsPage.centerView.postEdit.input).toHaveValue(message);
    await channelsPage.centerView.postEdit.writeMessage('');
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify a deletion confirmation is shown
    const confirmation = channelsPage.centerView.postEdit.deleteConfirmationDialog;
    await confirmation.toBeVisible();

    // # Confirm deletion
    await confirmation.confirmDeletion();

    // * Verify the post is removed
    await confirmation.notToBeVisible();
    await stablePost.notToBeVisible();
});

/**
 * @objective Verify clearing all text while editing a post with an attachment preserves the post and file.
 */
test(
    'MM-T1271_2 Up clears text without deleting a post that has an attachment',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const message = `Message with attachment ${pw.random.id()}`;
        const filename = 'mattermost.png';
        const {user, team} = await pw.initSetup();

        // # Post a message with an attachment, press Up, and clear its text
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(message, [filename]);
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ArrowUp');
        await channelsPage.centerView.postEdit.toBeVisible();
        await channelsPage.centerView.postEdit.writeMessage('');
        await channelsPage.centerView.postEdit.sendMessage();

        // * Verify no deletion confirmation appears and the attachment and edited indicator remain
        await channelsPage.centerView.postEdit.deleteConfirmationDialog.notToBeVisible();
        const editedPost = await channelsPage.getLastPost();
        await editedPost.toNotContainText(message);
        await editedPost.toHaveFile(filename);
        await editedPost.toBeEdited();
    },
);

/**
 * @objective Verify clearing a reply opened for editing with Up prompts for deletion and deletes the reply.
 */
test('MM-T1272 Up deletes a reply when its edit is cleared', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const message = `Thread root ${pw.random.id()}`;
    const reply = `Reply to delete ${pw.random.id()}`;
    const {user, team} = await pw.initSetup();

    // # Post a root message and reply to it in the right sidebar
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(message);
    const rootPost = await channelsPage.getLastPost();
    await rootPost.openAThread();
    await channelsPage.sidebarRight.postMessage(reply);
    const replyPost = await channelsPage.sidebarRight.getLastPost();
    await replyPost.toContainText(reply);
    const stableReplyPost = await channelsPage.sidebarRight.getPostById(await replyPost.getId());

    // # Focus the reply textbox, press Up, and clear the reply edit
    await channelsPage.sidebarRight.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');
    await channelsPage.sidebarRight.postEdit.toBeVisible();
    await expect(channelsPage.sidebarRight.postEdit.input).toHaveValue(reply);
    await channelsPage.sidebarRight.postEdit.writeMessage('');
    await channelsPage.sidebarRight.postEdit.sendMessage();

    // * Verify a deletion confirmation is shown
    const confirmation = channelsPage.sidebarRight.postEdit.deleteConfirmationDialog;
    await confirmation.toBeVisible();

    // # Confirm deletion
    await confirmation.confirmDeletion();

    // * Verify the reply is removed
    await confirmation.notToBeVisible();
    await stableReplyPost.notToBeVisible();
});
