// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {ORIGINAL_MESSAGE} from './support';

test('MM-T5654_3 should be able to edit post message originally containing files', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage, ['sample_text_file.txt']);

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
    await channelsPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('MM-T5656_1 should be able to restore previously edited post version that contains attachments', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;
    const newMessage = 'New Message';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();

    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelsPage.centerView.postEdit.writeMessage(newMessage);
    await channelsPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(newMessage);
    await updatedPost.toNotContainText('sample_text_file.txt');

    const postID = await channelsPage.centerView.getLastPostID();
    await channelsPage.centerView.clickOnLastEditedPost(postID);

    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.verifyCurrentVersionPostMessage(postID, newMessage);

    await channelsPage.sidebarRight.restorePreviousPostVersion();

    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.confirmRestore();
    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.notToBeVisible();

    const restoredPost = await channelsPage.getLastPost();
    await restoredPost.toBeVisible();
    await restoredPost.toContainText('sample_text_file.txt');
});
