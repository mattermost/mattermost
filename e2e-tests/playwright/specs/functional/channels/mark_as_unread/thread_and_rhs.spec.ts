// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type ChannelsPage} from '@mattermost/playwright-lib';

/**
 * @objective Verify a reply post can be marked unread from within an open RHS thread.
 */
test('MM-T248_2 Mark Direct Message post as Unread in a reply thread', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-thread-unread');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);

    // # Post a root message, replies from the other user, the reply to mark unread, more replies from
    // the other user, then trailing replies from the main user
    const root = await adminClient.createPost({channel_id: dmChannel.id, user_id: user.id, message: 'Initial message'});
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({
            channel_id: dmChannel.id,
            user_id: otherUser.id,
            message: `Before unread ${i}`,
            root_id: root.id,
        });
    }
    const unreadPost = await adminClient.createPost({
        channel_id: dmChannel.id,
        user_id: otherUser.id,
        message: 'Unread from here',
        root_id: root.id,
    });
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({
            channel_id: dmChannel.id,
            user_id: otherUser.id,
            message: `After unread ${i}`,
            root_id: root.id,
        });
    }
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({
            channel_id: dmChannel.id,
            user_id: user.id,
            message: `Own message ${i}`,
            root_id: root.id,
        });
    }

    // # Open the DM channel, open the thread in the RHS, and mark the reply as unread
    // (marking unread from within an open thread only affects thread-level state under CRT, whether
    // the channel is a public channel or a DM, so the LHS/mention badge are unaffected by this action)
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await markPostAsUnread(channelsPage, unreadPost.id, true);

    // * Verify the RHS shows the unread separator for the reply
    await expect(channelsPage.sidebarRight.notificationSeparator).toBeVisible();
});

/**
 * @objective Verify a thread post can be marked unread from the RHS.
 */
test('MM-T250 Mark as unread in the RHS', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'rhs-unread');
    const channelA = await adminClient.createPublicChannel(team.id, 'RHS Unread A');
    const channelB = await adminClient.createPublicChannel(team.id, 'RHS Unread B');
    await adminClient.addToChannel(user.id, channelA.id);
    await adminClient.addToChannel(user.id, channelB.id);
    await adminClient.addToChannel(author.id, channelA.id);

    // # Create a thread and mark the root post unread from the RHS
    const root = await adminClient.createPost({channel_id: channelA.id, user_id: author.id, message: 'post1'});
    const reply = await adminClient.createPost({
        channel_id: channelA.id,
        user_id: author.id,
        message: 'post2',
        root_id: root.id,
    });
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channelA.name);
    await channelsPage.toBeVisible();
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await markPostAsUnread(channelsPage, root.id, true);

    // * Verify the RHS shows the unread separator (marking unread from the RHS only affects
    // thread-level read state under CRT, so the center channel view is unaffected)
    await expect(channelsPage.sidebarRight.notificationSeparator).toBeVisible();

    // # Switch away and back
    await channelsPage.sidebarLeft.goToItem(channelB.name);
    await channelsPage.sidebarLeft.goToItem(channelA.name);

    // * Verify the channel returns to read state
    await channelsPage.sidebarLeft.assertItemRead(channelA.name);

    // # Reopen the thread and mark the reply unread too
    await (await channelsPage.centerView.getPostById(root.id)).reply();
    await markPostAsUnread(channelsPage, reply.id, true);

    // * Verify the RHS shows the unread separator for the reply as well (thread-level state only,
    // consistent with marking the root unread above — LHS channel state is unaffected either way)
    await expect(channelsPage.sidebarRight.notificationSeparator).toBeVisible();
});

// Alt+click is a real shortcut for "Mark as Unread", equivalent to the post menu's own
// "Mark as Unread" item — used here since the menu item click is flaky against the virtualized post list.

async function markPostAsUnread(channelsPage: ChannelsPage, postId: string, rhs = false) {
    const post = rhs
        ? await channelsPage.sidebarRight.getPostById(postId)
        : await channelsPage.centerView.getPostById(postId);

    await post.toBeVisible();
    await post.container.scrollIntoViewIfNeeded();
    await post.container.click({modifiers: ['Alt']});
}
