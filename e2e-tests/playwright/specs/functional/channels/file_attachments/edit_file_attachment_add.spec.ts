// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {ORIGINAL_MESSAGE, moveMouseToCenter} from './support';

/**
 * @objective Verify that users can edit a post and modify its content
 */
test('MM-T5654_1 should be able to add attachments while editing a post', {tag: '@smoke'}, async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    // # Initialize user and login
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate to channels page and post a message
    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage);

    // # Hover over the last post to reveal the post menu
    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // # Open the dot menu and click edit
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();

    // # Edit the message and send
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage('Edited message');
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the post was updated with the edited message
    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('MM-T5654_2 should be able to add attachments while editing a threaded post', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage);

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.replyMenuItem.click();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postCreate.toBeVisible();
    await channelsPage.sidebarRight.postMessage('Replying to the post');
    await channelsPage.sidebarRight.toContainText('Replying to the post');

    const replyPost = await channelsPage.sidebarRight.getLastPost();
    await replyPost.toBeVisible();
    await replyPost.hover();
    await replyPost.postMenu.toBeVisible();
    await replyPost.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.sidebarRight.postEdit.toBeVisible();
    await channelsPage.sidebarRight.postEdit.writeMessage('Edited reply message');
    await channelsPage.sidebarRight.postEdit.sendMessage();

    let updatedReplyPost = await channelsPage.sidebarRight.getLastPost();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message');

    // now we'll edit the reply post and files to it
    await updatedReplyPost.hover();
    await updatedReplyPost.postMenu.toBeVisible();
    await updatedReplyPost.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.sidebarRight.postEdit.toBeVisible();
    await channelsPage.sidebarRight.postEdit.writeMessage('Edited reply message with files');
    await channelsPage.sidebarRight.postEdit.addFiles(['sample_text_file.txt', 'mattermost.png']);
    await pw.wait(pw.duration.half_sec);
    await channelsPage.sidebarRight.postEdit.sendMessage();
    await pw.wait(pw.duration.half_sec);
    await channelsPage.sidebarRight.postEdit.toNotBeVisible();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message with files');
    await updatedReplyPost.toContainText('sample_text_file.txt');
    await updatedReplyPost.toContainText('mattermost.png');

    // now we'll remove the files
    await updatedReplyPost.hover();
    await updatedReplyPost.postMenu.toBeVisible();
    await updatedReplyPost.postMenu.clickOnDotMenu();
    await moveMouseToCenter(page);
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.sidebarRight.postEdit.toBeVisible();
    await channelsPage.sidebarRight.postEdit.removeFile('sample_text_file.txt');
    await pw.wait(pw.duration.half_sec);
    await channelsPage.sidebarRight.postEdit.removeFile('mattermost.png');
    await pw.wait(pw.duration.half_sec);
    await channelsPage.sidebarRight.postEdit.sendMessage();

    updatedReplyPost = await channelsPage.sidebarRight.getLastPost();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message with files');
    await updatedReplyPost.toNotContainText('sample_text_file.txt');
    await updatedReplyPost.toNotContainText('mattermost.png');
});

test('MM-T5654_4 should be able to add files when editing a post', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage);

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage('Edited message');
    await channelsPage.centerView.postEdit.addFiles(['sample_text_file.txt']);
    await channelsPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
    await updatedPost.toContainText('sample_text_file.txt');

    // now we'll add multiple files
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.addFiles(['mattermost.png', 'archive.zip']);
    await channelsPage.centerView.postEdit.sendMessage();

    const secondUpdatedPost = await channelsPage.getLastPost();
    await secondUpdatedPost.toBeVisible();
    await secondUpdatedPost.toContainText('Edited message');
    await secondUpdatedPost.toContainText('sample_text_file.txt');
    await secondUpdatedPost.toContainText('mattermost.png');
    await secondUpdatedPost.toContainText('archive.zip');
});
