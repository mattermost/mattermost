// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, fileIdsOf, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify that users can edit a message that has an attachment,
 * the attachment is preserved after edit, and the edited indicator appears.
 */
test('MM-T2268 Edit Message with Attachment', async ({pw}) => {
    // # Post a message with an image attachment
    const {team, user, userClient, townSquare: channel} = await pw.initSetup();
    const post = await userClient.createTestPost({channel_id: channel.id, message: 'Test'}, ['mattermost.png']);

    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // * Verify the post shows its message and attachment, and is not marked edited
    const shown = app.center.postList.post(post);
    await expect(shown.message.container).toHaveText('Test');
    const [imageId] = fileIdsOf(post);
    const image = shown.attachments.image({id: imageId});
    await expect(image).toBeVisible();
    await expect(shown.editedHistoryButton).not.toBeVisible();

    // # Edit the message with the Up arrow shortcut
    await app.center.postCreate.message.container.press('ArrowUp');
    const editor = app.postEdit.editor.message.container;
    await expect(editor).toHaveValue('Test');
    await editor.fill('Test with some edit');
    await settle(app.postEdit.editor.saveButton, {wait: Api.PatchPost}).click();

    // * Verify the edited message keeps its attachment and is marked edited
    // (the edited marker renders inside the message text)
    await expect(shown.message.container).toContainText('Test with some edit');
    await expect(image).toBeVisible();
    await expect(shown.editedHistoryButton).toBeVisible();
});
