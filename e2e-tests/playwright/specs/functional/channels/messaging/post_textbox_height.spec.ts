// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a long reply draft keeps the expanded reply textbox height after switching threads.
 */
test('MM-T212 keeps a long draft expanded in the reply input', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    const firstPost = await adminClient.createPost({
        channel_id: offTopic.id,
        user_id: user.id,
        message: 'test post 1',
    });
    const secondPost = await adminClient.createPost({
        channel_id: offTopic.id,
        user_id: user.id,
        message: 'test post 2',
    });

    // # Log in, open the latest post's thread, and record the reply textbox's initial height
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, offTopic.name);
    await channelsPage.toBeVisible();
    await (await channelsPage.centerView.getPostById(secondPost.id)).reply();
    await channelsPage.sidebarRight.toBeVisible();
    const replyInput = channelsPage.sidebarRight.postCreate.input;
    await expect(replyInput).toHaveCSS('height', '46px');
    const initialBox = await replyInput.boundingBox();
    expect(initialBox).not.toBeNull();

    // # Enter a reply draft with enough line breaks to expand the textbox
    await channelsPage.sidebarRight.postCreate.writeMessage(`test${'\n'.repeat(8)}test`);

    // * Verify the reply textbox grows to more than twice its original height
    const expandedBox = await replyInput.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.height).toBeGreaterThan(initialBox!.height * 2);

    // # Switch to the first post's thread, then return to the latest post's thread
    await (await channelsPage.centerView.getPostById(firstPost.id)).reply();
    await (await channelsPage.centerView.getPostById(secondPost.id)).reply();

    // * Verify the long draft and expanded textbox height are restored
    await expect(replyInput).toHaveValue(`test${'\n'.repeat(8)}test`);
    const restoredBox = await replyInput.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(restoredBox!.height).toBeGreaterThan(initialBox!.height * 2);
});
