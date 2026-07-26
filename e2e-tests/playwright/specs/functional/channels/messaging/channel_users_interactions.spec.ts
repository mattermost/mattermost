// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify sending a message in a channel with unread content scrolls to the newly sent message.
 */
test('MM-T216 scrolls to the bottom when sending a message', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender] = await adminClient.createUsers(team.id, 1, 'sender');
    const testChannel = await adminClient.createPublicChannel(team.id, 'Channel Users Interactions');
    await adminClient.addToChannel(user.id, testChannel.id);
    await adminClient.addToChannel(sender.id, testChannel.id);

    // # Log in, visit the test channel once, then move to Off-Topic
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, testChannel.name);
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('Hello');
    await channelsPage.sidebarLeft.goToItem('off-topic');

    // # Have another user post a tall message in the test channel, then post in Off-Topic
    await adminClient.createPost({
        channel_id: testChannel.id,
        user_id: sender.id,
        message: `I'm messaging!${'\n2'.repeat(30)}`,
    });
    await channelsPage.postMessage('Hello');
    await (await channelsPage.getLastPost()).toContainText('Hello');

    // # Return to the test channel
    await channelsPage.sidebarLeft.goToItem(testChannel.name);

    // * Verify the new-message separator is visible
    await channelsPage.centerView.toHaveNewMessagesSeparator();

    // # Send a message in the current channel
    await channelsPage.postMessage('message123');

    // * Verify the newly sent message is the visible last post
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    await expect(lastPost.messageText).toHaveText('message123');
});
