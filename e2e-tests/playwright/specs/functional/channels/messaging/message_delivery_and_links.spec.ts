// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify the RHS thread refreshes replies when the center channel has changed.
 */
test('MM-T94 RHS fetches messages on reconnect while a different channel is in center', async ({pw}) => {
    const {adminClient, team, user, offTopic, townSquare} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'reconnect-author');
    const threadChannel = await adminClient.createPublicChannel(team.id, 'RHS Reconnect');
    await adminClient.addToChannel(user.id, threadChannel.id);
    await adminClient.addToChannel(author.id, threadChannel.id);
    const {client: authorClient} = await pw.makeClient({username: author.username, password: author.password});

    // # Open a thread in the RHS and add an initial reply
    const root = await authorClient.createPost({channel_id: threadChannel.id, message: 'reconnect root'});
    const {app, page} = await pw.testBrowser.login(user);
    await pw.mockWebsockets(page);
    await app.channelsPage.goto({team, channel: threadChannel});
    await pw.connectWebsockets(page);
    const rootPost = app.center.postList.post(root);
    await rootPost.container.hover();
    await rootPost.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    await app.rhs.postCreate.message.container.fill('def');
    await settle(app.rhs.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect.poll(async () => (await app.rhs.thread.postList.keys()).length).toBe(2);

    // # Change the center channel, then go offline while the author replies
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    await pw.closeWebsockets(page);
    const missed = await authorClient.createPost({channel_id: threadChannel.id, message: 'ghi', root_id: root.id});

    // * The reply posted while disconnected hasn't reached the RHS
    expect(await app.rhs.thread.postList.keys()).not.toContain(missed.id);

    // # Reconnect and nudge the client with some activity so it resyncs missed messages
    await pw.connectWebsockets(page);
    await app.lhs.channelList.channel(townSquare).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
    await app.center.postCreate.message.container.fill('nudge 1');
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    await app.center.postCreate.message.container.fill('nudge 2');
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * The RHS fetches the missed reply after reconnecting
    await expect(app.rhs.thread.postList).toContainKeys([missed.id], {timeout: pw.duration.ten_sec});
    await expect(app.rhs.thread.post(missed).message.container).toHaveText('ghi');
});

/**
 * @objective Verify channel short-linking still works when the channel reference is surrounded by brackets.
 */
test('MM-T175 Channel short-linking still works when placed in brackets', async ({pw}) => {
    const {adminClient, team, user, userClient, offTopic} = await pw.initSetup();
    const linkedChannel = await adminClient.createPublicChannel(team.id, 'Shortlink Target');
    await adminClient.addToChannel(user.id, linkedChannel.id);
    const post = await userClient.createPost({channel_id: offTopic.id, message: `(~${linkedChannel.name})`});

    // # Open Off-Topic, where a bracketed channel shortlink was posted
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});

    // # Click the rendered channel link
    const markdown = app.center.postList.post(post).markdown;
    await expect(markdown.channelMentionLink).toHaveText(`~${linkedChannel.display_name}`);
    await markdown.channelMentionLink.click();

    // * The linked channel opens
    await expect(page).toHavePath(`/${team.name}/channels/${linkedChannel.name}`);
    await expect(app.channelHeader.openMenuButton).toContainText(linkedChannel.display_name);
});
