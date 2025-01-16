// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@e2e-support/test_fixture';
import pages from '@e2e-support/ui/pages';
import {expect} from '@playwright/test';
import {duration, wait} from '@e2e-support/util';

test('should be able to edit post message', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.writeMessage('Edited message');
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('should be able to edit post message in RHS', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.replyMenuItem.click();
    await channelPage.sidebarRight.toBeVisible();
    await channelPage.sidebarRight.postCreate.toBeVisible();
    await channelPage.sidebarRight.postCreate.postMessage('Replying to the post');
    await channelPage.sidebarRight.toContainText('Replying to the post');

    const replyPost = await channelPage.sidebarRight.getLastPost();
    await replyPost.toBeVisible();
    await replyPost.hover();
    await replyPost.postMenu.toBeVisible();
    await replyPost.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.sidebarRight.postEdit.toBeVisible();
    await channelPage.sidebarRight.postEdit.writeMessage('Edited reply message');
    await channelPage.sidebarRight.postEdit.sendMessage();

    let updatedReplyPost = await channelPage.sidebarRight.getLastPost();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message');

    // now we'll edit the reply post and files to it
    await updatedReplyPost.hover();
    await updatedReplyPost.postMenu.toBeVisible();
    await updatedReplyPost.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.sidebarRight.postEdit.toBeVisible();
    await channelPage.sidebarRight.postEdit.writeMessage('Edited reply message with files');
    await channelPage.sidebarRight.postEdit.addFiles(['sample_text_file.txt', 'mattermost.png']);
    await wait(duration.half_sec);
    await channelPage.sidebarRight.postEdit.sendMessage();
    await wait(duration.half_sec);
    await channelPage.sidebarRight.postEdit.toNotBeVisible();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message with files');
    await updatedReplyPost.toContainText('sample_text_file.txt');
    await updatedReplyPost.toContainText('mattermost.png');

    // now we'll remove the files
    await updatedReplyPost.hover();
    await updatedReplyPost.postMenu.toBeVisible();
    await updatedReplyPost.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.sidebarRight.postEdit.toBeVisible();
    await channelPage.sidebarRight.postEdit.removeFile('sample_text_file.txt');
    await wait(duration.half_sec);
    await channelPage.sidebarRight.postEdit.removeFile('mattermost.png');
    await wait(duration.half_sec);
    await channelPage.sidebarRight.postEdit.sendMessage();

    updatedReplyPost = await channelPage.sidebarRight.getLastPost();
    await updatedReplyPost.toBeVisible();
    await updatedReplyPost.toContainText('Edited reply message with files');
    expect(updatedReplyPost).not.toContain('sample_text_file.txt');
    expect(updatedReplyPost).not.toContain('mattermost.png');
});

test('should be able to edit post message originally containing files', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.writeMessage('Edited message');
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
});

test('should be able to add files when editing a post', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.hover();
    await post.postMenu.toBeVisible();

    // open the dot menu
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.writeMessage('Edited message');
    await channelPage.centerView.postEdit.addFiles(['sample_text_file.txt']);
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText('Edited message');
    await updatedPost.toContainText('sample_text_file.txt');

    // now we'll add multiple files
    await post.postMenu.dotMenuButton.click();
    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.addFiles(['mattermost.png', 'archive.zip']);
    await channelPage.centerView.postEdit.sendMessage();

    const secondUpdatedPost = await channelPage.centerView.getLastPost();
    await secondUpdatedPost.toBeVisible();
    await secondUpdatedPost.toContainText('Edited message');
    await secondUpdatedPost.toContainText('sample_text_file.txt');
    await secondUpdatedPost.toContainText('mattermost.png');
    await secondUpdatedPost.toContainText('archive.zip');
});

test('should be able to remove some files when editing a post', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage, [
        'sample_text_file.txt',
        'mattermost.png',
        'archive.zip',
    ]);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');
    await post.toContainText('mattermost.png');
    await post.toContainText('archive.zip');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();

    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    await updatedPost.toContainText('mattermost.png');
    await updatedPost.toContainText('archive.zip');
    expect(updatedPost).not.toContain('archive.zip');
});

test('should be able to remove all files when editing a post', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage, [
        'sample_text_file.txt',
        'mattermost.png',
        'archive.zip',
    ]);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');
    await post.toContainText('mattermost.png');
    await post.toContainText('archive.zip');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();

    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelPage.centerView.postEdit.removeFile('mattermost.png');
    await channelPage.centerView.postEdit.removeFile('archive.zip');
    await channelPage.centerView.postEdit.sendMessage();

    const updatedPost = await channelPage.centerView.getLastPost();
    await updatedPost.toBeVisible();
    await updatedPost.toContainText(originalMessage);
    await expect(updatedPost).not.toContain('archive.zip');
    await expect(updatedPost).not.toContain('mattermost.png');
    await expect(updatedPost).not.toContain('sample_text_file.txt');
});

test('removing message content and files should delete the post', async ({pw}) => {
    test.setTimeout(120000);

    const originalMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

    const {user} = await pw.initSetup();
    const {page} = await pw.testBrowser.login(user);
    const channelPage = new pages.ChannelsPage(page);

    await channelPage.goto();
    await channelPage.toBeVisible();
    await channelPage.centerView.postCreate.postMessage(originalMessage, ['sample_text_file.txt']);

    const post = await channelPage.centerView.getLastPost();
    await post.toBeVisible();
    await post.toContainText(originalMessage);
    await post.toContainText('sample_text_file.txt');

    await post.hover();
    await post.postMenu.toBeVisible();
    await post.postMenu.dotMenuButton.click();

    await channelPage.postDotMenu.toBeVisible();
    await channelPage.postDotMenu.editMenuItem.click();
    await channelPage.centerView.postEdit.toBeVisible();
    await channelPage.centerView.postEdit.removeFile('sample_text_file.txt');
    await channelPage.centerView.postEdit.writeMessage('');
    await channelPage.centerView.postEdit.sendMessage();

    await channelPage.centerView.postEdit.deleteConfirmationDialog.toBeVisible();
    await channelPage.centerView.postEdit.deleteConfirmationDialog.confirmDeletion();
    await channelPage.centerView.postEdit.deleteConfirmationDialog.notToBeVisible();

    expect(channelPage).not.toContain(originalMessage);
    expect(channelPage).not.toContain('sample_text_file.txt');
});
