// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a user can view a message's edit history and restore a previous version, and that
 * cancelling the restore confirmation keeps the edited version.
 */
test('MM-T5537 views message edit history and restores a previous version', {tag: '@messaging'}, async ({pw}) => {
    const {team, user, userClient, townSquare: channel} = await pw.initSetup();
    // # Log in and open the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Post a message
    const message = `This is a message to post and then edit ${pw.random.id()}`;
    const composer = app.center.postCreate;
    await composer.message.container.fill(message);
    const created = await settle(composer.sendButton, {wait: Api.CreatePost}).click();

    // # Open the last post for editing with the up arrow, append text, and save
    await composer.message.container.press('ArrowUp');
    const editor = app.postEdit.editor;
    await expect(editor.message.container).toHaveValue(message);
    await editor.message.container.press('End');
    await expect(editor.message.container).toHaveJSProperty('selectionStart', message.length);
    await editor.message.container.type('. I have now edited this message.');
    const edited = await settle(editor.saveButton, {wait: Api.PatchPost}).click();

    // * The post shows the edited text
    const post = app.center.postList.post(created);
    expect(edited.message).toBe(`${message}. I have now edited this message.`);
    await expect(post.message.container).toContainText(edited.message);

    // # Open the edit history from the post's "Edited" label
    await post.editedHistoryButton.click();
    await expect(app.rhs.editHistory).toBeVisible();

    // # Expand the previous version, kept under the id the server gives it
    const [previous] = await userClient.getPostEditHistory(created.id);
    const version = app.rhs.editHistory.version(previous);
    // (the version's title row handles the click and covers its toggle button; Enter on the button reaches it)
    await version.toggleButton.press('Enter');

    // * It shows the original message
    await expect(version.message.container).toContainText(message);

    // # Open the restore confirmation for the previous version, then cancel it
    const cancelled = await version.restoreButton.clickTo(app.restorePostModal);
    await cancelled.cancelButton.click();
    await expect(cancelled).toHaveCount(0);

    // * The edited version is still displayed
    await expect(post.message.container).toContainText(edited.message);

    // # Restore the previous version and confirm
    const restore = await version.restoreButton.clickTo(app.restorePostModal);
    const restored = await settle(restore.confirmButton, {wait: Api.RestorePostVersion}).click();

    // * The server and the post have the original message again
    expect(restored.message).toBe(message);
    await expect(post.message.container).toContainText(message);
    await expect(post.message.container).not.toContainText('I have now edited this message');
});
