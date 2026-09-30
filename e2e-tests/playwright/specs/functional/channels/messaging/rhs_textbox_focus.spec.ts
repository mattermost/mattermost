// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify focus remains in the thread reply textbox after sending a previewed reply.
 */
test('MM-T3307 keeps focus in the RHS textbox after replying', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.getChannelByName(team.id, 'off-topic');
    const root = await adminClient.createPost({
        channel_id: channel.id,
        user_id: user.id,
        message: `RHS focus root ${pw.random.id()}`,
    });

    // # Open the root post's reply thread
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const rootPost = await channelsPage.centerView.getPostById(root.id);
    await rootPost.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // # Enter a reply, toggle its preview, and send it
    const replyInput = channelsPage.sidebarRight.postCreate.input;
    const replyMessage = `Reply while preserving focus ${pw.random.id()}`;
    await replyInput.fill(replyMessage);
    await channelsPage.sidebarRight.postCreate.previewButton.click();
    await channelsPage.sidebarRight.postCreate.sendMessageButton.click();

    // * Verify keyboard focus remains in the RHS reply textbox
    await expect(replyInput).toBeFocused();
    await (await channelsPage.sidebarRight.getLastPost()).toContainText(replyMessage);
});
