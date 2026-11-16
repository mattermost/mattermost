// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify CJK text can be posted as both a channel message and a thread reply.
 */
test('MM-T182 Typing using CJK keyboard', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const message = '안녕하세요';
    const reply = '닥터 카레브';

    // # Log in and post a CJK message
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(message);

    // * Verify the posted message contains the CJK text
    const rootPost = await channelsPage.getLastPost();
    await rootPost.toContainText(message);

    // # Open the post thread and send a CJK reply
    await rootPost.reply();
    await channelsPage.sidebarRight.toBeVisible();
    await channelsPage.sidebarRight.postMessage(reply);

    // * Verify the posted reply contains the CJK text
    const lastReply = await channelsPage.sidebarRight.getLastPost();
    await lastReply.toContainText(reply);
});
