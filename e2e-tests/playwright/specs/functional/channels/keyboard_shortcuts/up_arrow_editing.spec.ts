// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Up skips a channel system message and edits the preceding user post.
 */
test(
    'MM-T1265 Up skips a system message when editing the previous post',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const message = `Previous regular message ${pw.random.id()}`;
        const newHeader = `Updated header ${pw.random.id()}`;
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const offTopic = await userClient.getChannelByName(team.id, 'off-topic');

        // # Post a regular message, then update the channel header to create a system message
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, offTopic.name);
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(message);
        await adminClient.patchChannel(offTopic.id, {header: newHeader});
        await channelsPage.centerView.waitUntilLastPostContains(newHeader);

        // # Press Up from the center-channel textbox
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ArrowUp');

        // * Verify edit mode opens for the regular message rather than the system message
        await channelsPage.centerView.postEdit.toBeVisible();
        await expect(channelsPage.centerView.postEdit.input).toHaveValue(message);
    },
);

/**
 * @objective Verify a multiline code block can be opened with Up and edited.
 */
test('MM-T1269 Up edits a code block post', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const originalMessage = ['```', 'codeblock1', '```'].join('\n');
    const editedMessage = ['```', 'codeblock2', '```'].join('\n');
    const {user, team} = await pw.initSetup();

    // # Post a code block and press Up from the center-channel textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(originalMessage);
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');

    // # Replace the code block and save the edit
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage(editedMessage);
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the edited code block is displayed
    const editedPost = await channelsPage.getLastPost();
    await editedPost.toContainText('codeblock2');
    await editedPost.toNotContainText('codeblock1');
});

/**
 * @objective Verify Up can edit an attachment-only post, preserving its file and adding an edited indicator.
 */
test('MM-T1270 Up edits an attachment-only post', {tag: '@keyboard_shortcuts'}, async ({pw}) => {
    const filename = 'mattermost.png';
    const editedMessage = 'Test';
    const {user, team} = await pw.initSetup();

    // # Upload and send an attachment without entering message text
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.postAttachmentOnly([filename]);

    // * Verify the attachment-only post has no message text or edited indicator
    const post = await channelsPage.getLastPost();
    await post.toHaveFile(filename);
    await post.toHaveNoMessageText();
    await expect(post.editedIndicator).not.toBeVisible();

    // # Press Up, add text, and save the edit
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage(editedMessage);
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the text, attachment, and edited indicator are displayed
    const editedPost = await channelsPage.getLastPost();
    await editedPost.toContainText(editedMessage);
    await editedPost.toHaveFile(filename);
    await editedPost.toBeEdited();
});
