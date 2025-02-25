// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import {expect} from '@playwright/test';
import {duration, wait} from '@e2e-support/util';
import {moveMouseToCenter} from '@e2e-support/test_action';

test('MM-T5654_1 should be able to add attachments while editing a post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('MM-T5654_2 should be able to add attachments while editing a threaded post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelsPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();
    await channelsPage.postDotMenu.replyMenuItem.click();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postCreate.toBeVisible();
    await channelsPage.sidebarRight.postCreate.postMessage('Replying to the post');
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
    await wait(duration.half_sec);
    await channelsPage.sidebarRight.postEdit.sendMessage();
    await wait(duration.half_sec);
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
    await wait(duration.half_sec);
    await channelsPage.sidebarRight.postEdit.removeFile('mattermost.png');
    await wait(duration.half_sec);
    await channelsPage.sidebarRight.postEdit.sendMessage();

    updatedReplyPost = await channelsPage.sidebarRight.getLastPost();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message with files');
    expect(updatedReplyPost).not.toContain('sample_text_file.txt');
    expect(updatedReplyPost).not.toContain('mattermost.png');
});

test('MM-T5654_3 should be able to edit post message originally containing files', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('MM-T5654_4 should be able to add files when editing a post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
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

    const secondUpdatedPost = await channelsPage.centerView.getLastPost();
    await secondUpdatedPost.toBeVisible();
    await secondUpdatedPost.toContainText('Edited message');
    await secondUpdatedPost.toContainText('sample_text_file.txt');
    await secondUpdatedPost.toContainText('mattermost.png');
    await secondUpdatedPost.toContainText('archive.zip');
});

test('MM-5654_5 should be able to remove attachments while editing a post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage, [
        'sample_text_file.txt',
        'mattermost.png',
        'archive.zip',
    ]);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    await updatedPost.toContainText('mattermost.png');
    await updatedPost.toContainText('archive.zip');
    expect(updatedPost).not.toContain('archive.zip');
});

test('MM-T5655_1 removing message content and files should delete the post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelsPage.centerView.getLastPost();
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

    expect(channelsPage).not.toContain(originalMessage);
    expect(channelsPage).not.toContain('sample_text_file.txt');
});

test('MM-T5655_2 should be able to remove all files when editing a post', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage, [
        'sample_text_file.txt',
        'mattermost.png',
        'archive.zip',
    ]);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    expect(updatedPost).not.toContain('archive.zip');
    expect(updatedPost).not.toContain('mattermost.png');
    expect(updatedPost).not.toContain('sample_text_file.txt');
});

test('MM-T5656_1 should be able to restore previously edited post version that contains attachments', async ({pw}) => {
    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';
    const newMessage = 'New Message';

    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelsPage.centerView.getLastPost();
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

    const updatedPost = await channelsPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(newMessage);
    expect(updatedPost).not.toContain('sample_text_file.txt');

    const postID = await channelsPage.centerView.getLastPostID();
    await channelsPage.centerView.clickOnLastEditedPost(postID);

    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.verifyCurrentVersionPostMessage(postID, newMessage);

    await channelsPage.sidebarRight.restorePreviousPostVersion();

    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.toBeVisible();
    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.confirmRestore();
    await channelsPage.centerView.postEdit.restorePostConfirmationDialog.notToBeVisible();

    const restoredPost = await channelsPage.centerView.getLastPost();
    await restoredPost.toBeVisible();
    expect(restoredPost.toContainText('sample_text_file.txt'));
});
