// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify an overlong thread reply shows the character-count warning and is not posted.
 */
test('MM-T106 Webapp: Message too long warning text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, adminClient, userClient, offTopic: channel} = await pw.initSetup();
    // MaxPostSize is a computed client-config value, so read it rather than hardcoding.
    const clientConfig = await adminClient.getClientConfig();
    const maxReplyLength = parseInt(clientConfig.MaxPostSize, 10);
    const validReply = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    const tooLongReply = validReply.repeat(maxReplyLength / validReply.length + 1);
    const tooLongWarning = `Your message is too long. Character count: ${tooLongReply.length}/${maxReplyLength}`;

    // # Post a root message in Off-Topic, log in, and open its thread
    const root = await userClient.createPost({channel_id: channel.id, message: `Hello ${pw.random.id()}`});
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    const rootPost = app.center.postList.post(root);
    await rootPost.container.hover();
    await rootPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    const composer = app.rhs.postCreate;

    // # Post a valid reply
    await composer.message.container.fill(validReply);
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();

    // * The reply is posted, and no overlong-message warning is shown
    await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBe(2);
    await expect(composer.errorText).toHaveCount(0);

    // # Enter an overlong reply and try to send it
    await composer.message.container.fill(tooLongReply);

    // * The character-count warning is shown, without replacing the reply textbox
    await expect(composer.errorText).toHaveText(tooLongWarning);
    await expect(composer.message.container).toBeVisible();
    await composer.message.container.press('Enter');

    // * The warning remains, and nothing more was posted
    await expect(composer.errorText).toHaveText(tooLongWarning);
    expect((await app.rhs.thread.postList.keys()).length).toBe(2);
    const thread = await userClient.getPostThread(root.id);
    expect(thread.order).toHaveLength(2);
});
