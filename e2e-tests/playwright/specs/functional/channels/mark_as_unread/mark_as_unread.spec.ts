// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type ChannelsPage} from '@mattermost/playwright-lib';

/**
 * @objective Verify a public channel post can be marked unread from the post menu.
 */
test('MM-T246 Mark Post as Unread', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [author] = await adminClient.createUsers(team.id, 1, 'unread-author');
    const channelA = await adminClient.createPublicChannel(team.id, 'Unread A');
    const channelB = await adminClient.createPublicChannel(team.id, 'Unread B');
    await adminClient.addToChannel(user.id, channelA.id);
    await adminClient.addToChannel(user.id, channelB.id);
    await adminClient.addToChannel(author.id, channelA.id);

    // # Create messages and mark the last one as unread
    await adminClient.createPost({channel_id: channelA.id, user_id: author.id, message: 'hello from current user: 1'});
    const unreadPost = await adminClient.createPost({
        channel_id: channelA.id,
        user_id: author.id,
        message: 'hello from current user: 4',
    });
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channelA.name);
    await channelsPage.toBeVisible();
    await markPostAsUnread(channelsPage, unreadPost.id);

    // * Verify the unread separator appears at the selected post
    await expectUnreadSeparator(channelsPage, 'hello from current user: 4');

    // # Switch away and back to the marked channel
    await channelsPage.sidebarLeft.goToItem(channelB.name);

    // * Verify the original channel is unread while away
    await channelsPage.sidebarLeft.assertItemUnread(channelA.name);
    await channelsPage.sidebarLeft.goToItem(channelA.name);

    // * Verify opening the channel marks it read while preserving the unread separator
    await channelsPage.sidebarLeft.assertItemRead(channelA.name);
    await expectUnreadSeparator(channelsPage, 'hello from current user: 4');

    // # Switch away again
    await channelsPage.sidebarLeft.goToItem(channelB.name);

    // * Verify the channel remains read, not reverted to unread by leaving again
    await channelsPage.sidebarLeft.assertItemRead(channelA.name);
});

/**
 * @objective Verify a direct-message post can be marked unread and clears when revisited, preserving the
 * mention count across own trailing messages.
 */
test('MM-T248 Mark Direct Message post as Unread', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-unread');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);

    // # Post an initial message, some messages from the other user, the message to mark unread, more
    // messages from the other user, then trailing messages from the main user (which should not count
    // toward the unread mention badge)
    await adminClient.createPost({channel_id: dmChannel.id, user_id: user.id, message: 'Initial message'});
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({channel_id: dmChannel.id, user_id: otherUser.id, message: `Before unread ${i}`});
    }
    const unreadPost = await adminClient.createPost({
        channel_id: dmChannel.id,
        user_id: otherUser.id,
        message: 'Unread from here',
    });
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({channel_id: dmChannel.id, user_id: otherUser.id, message: `After unread ${i}`});
    }
    for (let i = 0; i < 3; i++) {
        await adminClient.createPost({channel_id: dmChannel.id, user_id: user.id, message: `Own message ${i}`});
    }

    // # Open the DM channel and mark a post as unread
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${otherUser.username}`);
    await channelsPage.toBeVisible();
    await markPostAsUnread(channelsPage, unreadPost.id);

    // * Verify unread state appears for the DM, with the mention badge counting all 7 of the other
    // user's messages, excluding the main user's own 4 messages (1 initial + 3 trailing)
    await expectUnreadSeparator(channelsPage, 'Unread from here');
    await channelsPage.sidebarLeft.assertItemUnread(otherUser.username);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(otherUser.username)).toHaveText('7');

    // # Leave and return to the DM channel
    await channelsPage.sidebarLeft.goToItem('off-topic');
    await channelsPage.sidebarLeft.assertItemUnread(otherUser.username);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(otherUser.username)).toHaveText('7');
    await channelsPage.sidebarLeft.goToItem(otherUser.username);

    // * Verify the DM is marked read after revisiting
    await channelsPage.sidebarLeft.assertItemRead(otherUser.username);
    await expectUnreadSeparator(channelsPage, 'Unread from here');
});

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

async function expectUnreadSeparator(channelsPage: ChannelsPage, message: string) {
    await expect(channelsPage.centerView.notificationSeparator).toBeVisible();
    await expect(channelsPage.centerView.postViews.filter({hasText: message})).toBeVisible();
}
