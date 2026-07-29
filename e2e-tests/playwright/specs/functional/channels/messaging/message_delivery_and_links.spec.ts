// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the RHS thread refreshes replies when the center channel has changed.
 */
test('MM-T94 RHS fetches messages on reconnect while a different channel is in center', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'reconnect-author');
    const threadChannel = await adminClient.createPublicChannel(team.id, 'RHS Reconnect');
    const offTopic = await adminClient.getChannelByName(team.id, 'off-topic');
    await adminClient.addToChannel(user.id, threadChannel.id);
    await adminClient.addToChannel(author.id, threadChannel.id);

    // # Open a thread in the RHS and add an initial reply
    const root = await adminClient.createPost({
        channel_id: threadChannel.id,
        user_id: author.id,
        message: 'reconnect root',
    });
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await pw.mockWebsockets(page);
    await channelsPage.goto(team.name, threadChannel.name);
    await channelsPage.toBeVisible();
    await pw.connectWebsockets(page);
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await channelsPage.sidebarRight.postMessage('def');

    // # Change the center channel, then go offline and have another user reply while disconnected
    await channelsPage.sidebarLeft.goToItem(offTopic.name);
    await pw.closeWebsockets(page);
    await adminClient.createPost({channel_id: threadChannel.id, user_id: author.id, message: 'ghi', root_id: root.id});
    await pw.wait(duration.four_sec);

    // * Verify the reply posted while disconnected has not reached the RHS
    await expect(channelsPage.sidebarRight.container).toContainText('def');
    await expect(channelsPage.sidebarRight.container).not.toContainText('ghi');

    // # Reconnect and nudge the client with some activity so it resyncs missed messages
    await pw.connectWebsockets(page);
    await channelsPage.sidebarLeft.goToItem('town-square');
    await channelsPage.postMessage('nudge 1');
    await channelsPage.sidebarLeft.goToItem(offTopic.name);
    await channelsPage.postMessage('nudge 2');
    await pw.wait(duration.two_sec);

    // * Verify the RHS fetches both replies after reconnecting
    await channelsPage.sidebarRight.toContainText('def');
    await channelsPage.sidebarRight.toContainText('ghi');
});

/**
 * @objective Verify channel short-linking still works when the channel reference is surrounded by brackets.
 */
test('MM-T175 Channel short-linking still works when placed in brackets', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const linkedChannel = await adminClient.createPublicChannel(team.id, 'Shortlink Target');
    await adminClient.addToChannel(user.id, linkedChannel.id);

    // # Post a bracketed channel shortlink from a different channel
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage(`(~${linkedChannel.name})`);

    // # Click the rendered channel link
    const lastPost = await channelsPage.getLastPost();
    await lastPost.getLink(linkedChannel.display_name).click();

    // * Verify the linked channel opens
    await expect(page).toHaveURL(`/${team.name}/channels/${linkedChannel.name}`);
    await channelsPage.centerView.header.toHaveTitle(linkedChannel.display_name);
});
