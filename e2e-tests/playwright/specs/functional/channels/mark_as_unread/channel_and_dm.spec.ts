// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, DefaultChannel} from '@mattermost/playwright-lib';

// A sidebar link's accessible name ends in "unread", or "N mention(s)", while the channel has unread messages
const UNREAD = / (unread|\d+ mentions?)$/;

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
    await pw.postAs(author, {channel_id: channelA.id, message: 'hello from current user: 1'});
    const unreadPost = await pw.postAs(author, {
        channel_id: channelA.id,
        message: 'hello from current user: 4',
    });
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channelA});
    const linkA = app.lhs.channelList.channel(channelA).container.locator;
    await markPostAsUnread(app, unreadPost);

    // * Verify the unread separator appears at the selected post
    await expectUnreadSeparator(app, unreadPost);

    // # Switch away and back to the marked channel
    await app.lhs.channelList.channel(channelB).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(channelB.display_name);

    // * Verify the original channel is unread while away
    await expect(linkA).toHaveAccessibleName(UNREAD);
    await app.lhs.channelList.channel(channelA).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(channelA.display_name);

    // * Verify opening the channel marks it read while preserving the unread separator
    await expect(linkA).not.toHaveAccessibleName(UNREAD);
    await expectUnreadSeparator(app, unreadPost);

    // # Switch away again
    await app.lhs.channelList.channel(channelB).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(channelB.display_name);

    // * Verify the channel remains read, not reverted to unread by leaving again
    await expect(linkA).not.toHaveAccessibleName(UNREAD);
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
    await pw.postAs(user, {channel_id: dmChannel.id, message: 'Initial message'});
    for (let i = 0; i < 3; i++) {
        await pw.postAs(otherUser, {channel_id: dmChannel.id, message: `Before unread ${i}`});
    }
    const unreadPost = await pw.postAs(otherUser, {
        channel_id: dmChannel.id,
        message: 'Unread from here',
    });
    for (let i = 0; i < 3; i++) {
        await pw.postAs(otherUser, {channel_id: dmChannel.id, message: `After unread ${i}`});
    }
    for (let i = 0; i < 3; i++) {
        await pw.postAs(user, {channel_id: dmChannel.id, message: `Own message ${i}`});
    }

    // # Open the DM channel and mark a post as unread
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
    const dm = app.lhs.channelList.channel(dmChannel);
    await markPostAsUnread(app, unreadPost);

    // * Verify unread state appears for the DM, with the mention badge counting the other user's 4 messages
    // from the unread point on (the marked one and the 3 after it), not the main user's own trailing messages
    await expectUnreadSeparator(app, unreadPost);
    await expect(dm).toHaveAccessibleName(UNREAD);
    await expect(dm.mentionBadgeText).toHaveText('4');

    // # Leave and return to the DM channel
    const offTopic = await adminClient.getChannelByName(team.id, DefaultChannel.OffTopic);
    await app.lhs.channelList.channel(offTopic).container.click();
    await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
    await expect(dm).toHaveAccessibleName(UNREAD);
    await expect(dm.mentionBadgeText).toHaveText('4');
    await dm.container.click();

    // * Verify the DM is marked read after revisiting
    await expect(dm).not.toHaveAccessibleName(UNREAD);
    await expectUnreadSeparator(app, unreadPost);
});

/** Marks the post unread with Alt+click on its body. */
async function markPostAsUnread(app: App, post: {id: string}) {
    const item = app.center.postList.post(post);
    await item.body.scrollIntoView();

    // on the message body: the post's middle can land on the author's name, which opens their profile popover
    await item.body.click({modifiers: ['Alt']});
    await expect(app.center.postList.newMessages).toBeVisible();
}

/** The "New Messages" separator shows, with the marked post displayed. */
async function expectUnreadSeparator(app: App, post: {id: string; message: string}) {
    await expect(app.center.postList.newMessages).toBeVisible();
    await expect(app.center.postList.post(post).message.container.locator).toHaveText(post.message);
}
