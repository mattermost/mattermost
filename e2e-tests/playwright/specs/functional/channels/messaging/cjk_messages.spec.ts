// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, postWith, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify CJK text can be posted as both a channel message and a thread reply.
 */
test('MM-T182 Typing using CJK keyboard', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, offTopic: channel} = await pw.initSetup();
    const message = '안녕하세요';
    const reply = '닥터 카레브';

    // # Log in and post a CJK message
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * The new post holds the CJK text
    const rootPost = await postWith(app.center.postList, {text: message});
    await expect(rootPost.message.container).toHaveText(message);

    // # Open the post's thread and send a CJK reply
    await rootPost.container.hover();
    await rootPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await app.rhs.postCreate.message.container.fill(reply);
    await settle(app.rhs.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * The reply holds the CJK text
    const replyPost = await postWith(app.rhs.thread, {text: reply});
    await expect(replyPost.message.container).toHaveText(reply);
});
