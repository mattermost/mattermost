// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Msg, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify sending a message in a channel with unread content scrolls to the newly sent message.
 */
test('MM-T216 scrolls to the bottom when sending a message', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user, offTopic} = await pw.initSetup();
    const [sender] = await adminClient.createUsers(team.id, 1, 'sender');
    const testChannel = await adminClient.createPublicChannel(team.id, 'Channel Users Interactions');
    await adminClient.addToChannel(user.id, testChannel.id);
    await adminClient.addToChannel(sender.id, testChannel.id);
    const send = async (message: string) => {
        await app.center.postCreate.message.container.fill(message);
        await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    };

    // # Log in, post in the test channel once, then move to Off-Topic
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: testChannel});
    await send('Hello');
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);

    // # Another user posts a tall message in the test channel; the user posts in Off-Topic
    const {client: senderClient} = await pw.makeClient({username: sender.username, password: sender.password});
    await senderClient.createPost({channel_id: testChannel.id, message: `I'm messaging!${'\n2'.repeat(30)}`});
    await send('Hello');

    // # Return to the test channel
    await app.lhs.channelList.channel(testChannel).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(testChannel.display_name);

    // * The new-messages separator is shown
    await expect(app.center.postList.newMessages).toContainMessage(Msg.posts_view.newMsg);

    // # Send a message in the test channel
    await send('message123');

    // * The sent message is the visible last post
    const sentId = await app.center.postList.postList.keyWith({text: 'message123'});
    const sent = app.center.postList.post({id: sentId});
    await expect(sent.message.container).toHaveText('message123');
    await expect(sent).toBeInViewport();
    await expect.poll(async () => (await app.center.postList.postList.keys()).at(-1)).toBe(sentId);
});
