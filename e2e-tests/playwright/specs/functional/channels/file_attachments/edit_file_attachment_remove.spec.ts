// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {ORIGINAL_MESSAGE, moveMouseToCenter} from './support';

test('MM-5654_5 should be able to remove attachments while editing a post', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage, ['sample_text_file.txt', 'mattermost.png', 'archive.zip']);

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');
    await post.toContainText('mattermost.png');
    await post.toContainText('archive.zip');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.clickOnDotMenu();
    await moveMouseToCenter(page);

    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelsPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    await updatedPost.toContainText('mattermost.png');
    await updatedPost.toContainText('archive.zip');
    await updatedPost.toNotContainText('sample_text_file.txt');
});

test('MM-T5655_1 removing message content and files should delete the post', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

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
    await channelsPage.centerView.postEdit.writeMessage('');
    await channelsPage.centerView.postEdit.sendMessage();

    await channelsPage.centerView.postEdit.deleteConfirmationDialog.toBeVisible();
    await channelsPage.centerView.postEdit.deleteConfirmationDialog.confirmDeletion();
    await channelsPage.centerView.postEdit.deleteConfirmationDialog.notToBeVisible();

    await channelsPage.toNotContainText(originalMessage);
    await channelsPage.toNotContainText('sample_text_file.txt');
});

test('MM-T5655_2 should be able to remove all files when editing a post', async ({pw}) => {
    const originalMessage = ORIGINAL_MESSAGE;

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage, ['sample_text_file.txt', 'mattermost.png', 'archive.zip']);

    const post = await channelsPage.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');
    await post.toContainText('mattermost.png');
    await post.toContainText('archive.zip');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.clickOnDotMenu();
    await moveMouseToCenter(page);

    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.editMenuItem.click();
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelsPage.centerView.postEdit.removeFile('mattermost.png');
    await channelsPage.centerView.postEdit.removeFile('archive.zip');
    await channelsPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelsPage.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    await updatedPost.toNotContainText('archive.zip');
    await updatedPost.toNotContainText('mattermost.png');
    await updatedPost.toNotContainText('sample_text_file.txt');
});
