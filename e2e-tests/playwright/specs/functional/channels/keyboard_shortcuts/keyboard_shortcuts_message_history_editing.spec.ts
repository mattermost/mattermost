// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg, Api, postWith, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify Ctrl/Cmd+Up and Ctrl/Cmd+Down cycle through previous messages in the post textbox.
 *
 * MM-T1256, MM-T1257, and MM-T1258 cover the same behavior as MM-T1254 and are covered by this test.
 */
test('MM-T1254 MM-T1256 MM-T1257 MM-T1258 CTRL/CMD+UP and CTRL/CMD+DOWN cycle previous messages', async ({pw}) => {
    const {user, team, townSquare: channel} = await pw.initSetup();
    const messages = ['post 1', 'post 2', 'post 3', 'post 4', 'post 5'];

    // # Post five messages from the message box
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const composer = app.center.postCreate;
    const input = composer.message.container;
    for (const [i, message] of messages.entries()) {
        await composer.message.container.fill(message);
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();
        await expect(input).toHaveValue('');
        await expect.poll(async () => (await app.center.postList.postList.keys()).length).toBeGreaterThanOrEqual(i + 1);
    }
    await input.focus();

    // # Cycle back through the messages with Ctrl/Cmd+Up
    // * Verify each one appears in turn, newest first
    for (const message of [...messages].reverse()) {
        await input.press('ControlOrMeta+ArrowUp');
        await expect(input).toHaveValue(message);
    }

    // # Press Ctrl/Cmd+Up past the oldest message
    // * Verify the oldest message stays
    await input.press('ControlOrMeta+ArrowUp');
    await expect(input).toHaveValue(messages[0]);

    // # Cycle forward with Ctrl/Cmd+Down
    // * Verify each newer message appears in turn
    for (const message of messages.slice(1)) {
        await input.press('ControlOrMeta+ArrowDown');
        await expect(input).toHaveValue(message);
    }
});

/**
 * @objective Verify Up arrow opens inline edit for the previous message and saving marks the post as edited.
 */
test('MM-T1260 UP arrow edits the previous post', async ({pw}) => {
    const {user, team, townSquare: channel} = await pw.initSetup();
    // # Post a message from the message box
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const composer = app.center.postCreate;
    const input = composer.message.container;
    await composer.message.container.fill('Test');
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    await expect(input).toHaveValue('');
    const post = await postWith(app.center.postList, {text: 'Test'});
    await expect(post.message.container).toHaveText('Test');

    // # Edit it with the Up arrow and save
    await input.press('ArrowUp');
    const editor = app.postEdit.editor.message.container;
    await expect(editor).toHaveValue('Test');
    await editor.fill('Edit Test');
    await settle(app.postEdit.editor.saveButton, {wait: Api.PatchPost}).click();

    // * Verify the post shows the edit and its edited marker
    // (the edited marker renders inside the message text)
    await expect(post.message.container).toContainText('Edit Test');
    await expect(post.editedHistoryButton).toContainMessage(Msg.post_message_view.edited);
});
