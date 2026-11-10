// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+Up and Ctrl/Cmd+Down cycle through previous messages in the post textbox.
 *
 * MM-T1256, MM-T1257, and MM-T1258 cover the same behavior as MM-T1254 and are covered by this test.
 */
test('MM-T1254 MM-T1256 MM-T1257 MM-T1258 CTRL/CMD+UP and CTRL/CMD+DOWN cycle previous messages', async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const messages = ['post 1', 'post 2', 'post 3', 'post 4', 'post 5'];

    // # Post several messages and focus the textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    for (const message of messages) {
        await channelsPage.postMessage(message);
    }
    await channelsPage.centerView.postCreate.input.focus();

    // * Verify Ctrl/Cmd+Up cycles backward through message history
    for (const message of [...messages].reverse()) {
        await page.keyboard.press('ControlOrMeta+ArrowUp');
        await expect(channelsPage.centerView.postCreate.input).toHaveValue(message);
    }

    // * Verify one extra Ctrl/Cmd+Up past the oldest message does not change the displayed message
    await page.keyboard.press('ControlOrMeta+ArrowUp');
    await expect(channelsPage.centerView.postCreate.input).toHaveValue(messages[0]);

    // * Verify Ctrl/Cmd+Down cycles forward through message history
    for (const message of messages.slice(1)) {
        await page.keyboard.press('ControlOrMeta+ArrowDown');
        await expect(channelsPage.centerView.postCreate.input).toHaveValue(message);
    }
});

/**
 * @objective Verify Up arrow opens inline edit for the previous message and saving marks the post as edited.
 */
test('MM-T1260 UP arrow edits the previous post', async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Post a message and press Up from the center textbox
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('Test');
    const postId = await channelsPage.centerView.getLastPostID();
    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');

    // # Edit and save the previous message
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.writeMessage('Edit Test');
    await channelsPage.centerView.postEdit.sendMessage();

    // * Verify the post was edited and has the edited marker
    const editedPost = await channelsPage.getLastPost();
    await editedPost.toContainText('Edit Test');
    await expect(channelsPage.centerView.editedPostIcon(postId)).toContainText('Edited');
});
