// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, createSurface, expect, settle, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify an overlong thread reply shows the character-count warning and is not posted.
 */
test('MM-T106 Webapp: Message too long warning text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, adminClient, userClient} = await pw.initSetup();
    // MaxPostSize is a computed client-config value, so read it rather than hardcoding.
    const clientConfig = await adminClient.getClientConfig();
    const maxReplyLength = parseInt(clientConfig.MaxPostSize, 10);
    const validReply = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    const tooLongReply = validReply.repeat(maxReplyLength / validReply.length + 1);

    // # Log in, open Off-Topic, post a root message, and open its thread
    const {channelsPage, page} = await pw.testBrowser.login(user);
    const surface = createSurface(page);
    await channelsPage.goto(team.name, 'off-topic');
    await surface.center().composer.toBeVisible();
    await channelsPage.centerView.postCreate.input.fill(`Hello ${pw.random.id()}`);
    const rootPostData = await settle<{id: string}>(surface.center().send, {wait: Api.CreatePost}).click();
    const rootPost = await channelsPage.getLastPost();
    await rootPost.reply();
    await surface.rhs().composer.toBeVisible();

    // # Post a valid reply
    await channelsPage.sidebarRight.postMessage(validReply);

    // * Verify no overlong-message warning is shown
    await channelsPage.sidebarRight.postCreate.toNotHaveMessageTooLongWarning();

    // # Enter an overlong reply and try to send it
    await channelsPage.sidebarRight.postCreate.input.fill(tooLongReply);

    // * Verify the character-count warning is visible without replacing the reply textbox
    await channelsPage.sidebarRight.postCreate.toHaveMessageTooLongWarning(tooLongReply.length, maxReplyLength);
    await expect(channelsPage.sidebarRight.postCreate.input).toBeVisible();
    await channelsPage.sidebarRight.postCreate.input.press('Enter');

    // * Verify the warning remains and only the root + valid reply exist on the server
    await channelsPage.sidebarRight.postCreate.toHaveMessageTooLongWarning(tooLongReply.length, maxReplyLength);
    const lastReply = await channelsPage.sidebarRight.getLastPost();
    await lastReply.toContainText(validReply);
    expect((await userClient.getPostThread(rootPostData.id)).order).toHaveLength(2);
});
