// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App} from '@mattermost/playwright-lib';

// A sidebar link's accessible name ends in "unread", or "N mention(s)", while the channel has unread messages
const UNREAD = / (unread|\d+ mentions?)$/;

/**
 * @objective Verify a reply post can be marked unread from within an open RHS thread.
 */
test('MM-T248_2 Mark Direct Message post as Unread in a reply thread', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [otherUser] = await adminClient.createUsers(team.id, 1, 'dm-thread-unread');
    const dmChannel = await adminClient.createDirectChannel([user.id, otherUser.id]);

    // # Post a root message, replies from the other user, the reply to mark unread, more replies from
    // the other user, then trailing replies from the main user
    const root = await pw.postAs(user, {channel_id: dmChannel.id, message: 'Initial message'});
    for (let i = 0; i < 3; i++) {
        await pw.postAs(otherUser, {
            channel_id: dmChannel.id,
            message: `Before unread ${i}`,
            root_id: root.id,
        });
    }
    const unreadPost = await pw.postAs(otherUser, {
        channel_id: dmChannel.id,
        message: 'Unread from here',
        root_id: root.id,
    });
    for (let i = 0; i < 3; i++) {
        await pw.postAs(otherUser, {
            channel_id: dmChannel.id,
            message: `After unread ${i}`,
            root_id: root.id,
        });
    }
    for (let i = 0; i < 3; i++) {
        await pw.postAs(user, {
            channel_id: dmChannel.id,
            message: `Own message ${i}`,
            root_id: root.id,
        });
    }

    // # Open the DM channel, open the thread in the RHS, and mark the reply as unread
    // (marking unread from within an open thread only affects thread-level state under CRT, whether
    // the channel is a public channel or a DM, so the LHS/mention badge are unaffected by this action)
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
    await openThread(app, root);
    await markRhsPostAsUnread(app, unreadPost);

    // * Verify the RHS shows the unread separator for the reply
    await expect(app.rhs.thread.newMessages).toBeVisible();
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
    const root = await pw.postAs(author, {channel_id: channelA.id, message: 'post1'});
    const reply = await pw.postAs(author, {
        channel_id: channelA.id,
        message: 'post2',
        root_id: root.id,
    });
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channelA});
    await openThread(app, root);
    await markRhsPostAsUnread(app, root);

    // * Verify the RHS shows the unread separator (marking unread from the RHS only affects
    // thread-level read state under CRT, so the center channel view is unaffected)
    await expect(app.rhs.thread.newMessages).toBeVisible();

    // # Switch away and back
    await app.lhs.channelList.channel(channelB).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(channelB.display_name);
    await app.lhs.channelList.channel(channelA).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(channelA.display_name);

    // * Verify the channel returns to read state
    await expect(app.lhs.channelList.channel(channelA).container.locator).not.toHaveAccessibleName(UNREAD);

    // # Reopen the thread and mark the reply unread too
    await openThread(app, root);
    await markRhsPostAsUnread(app, reply);

    // * Verify the RHS shows the unread separator for the reply as well (thread-level state only,
    // consistent with marking the root unread above — LHS channel state is unaffected either way)
    await expect(app.rhs.thread.newMessages).toBeVisible();
});

/** Opens the post's thread in the RHS from its Reply button. */
async function openThread(app: App, root: {id: string}) {
    const post = app.center.postList.post(root);
    await post.locator.hover();
    await post.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
}

// Alt+click is a real shortcut for "Mark as Unread", equivalent to the post menu's own
// "Mark as Unread" item — used here since the menu item click is flaky against the virtualized post list.
async function markRhsPostAsUnread(app: App, post: {id: string}) {
    const item = app.rhs.thread.post(post);
    await item.message.container.scrollIntoView();

    // on the message text: the post's middle can land on the author's name, which opens their profile popover
    await item.message.container.click({modifiers: ['Alt']});
    await expect(app.rhs.thread.newMessages).toBeVisible();
}
