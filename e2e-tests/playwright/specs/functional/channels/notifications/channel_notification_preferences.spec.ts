// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a channel-level mentions-only desktop notification preference suppresses ordinary posts and notifies for direct mentions.
 *
 * @precondition
 * - Two users are members of the same channel
 * - The receiving user's global desktop notification preference is set to all messages
 */
test('MM-T885 Channel notifications: Desktop notifications mentions only', {tag: '@notifications'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender] = await adminClient.createUsers(team.id, 1, 'notification-sender');
    const channel = await adminClient.createPublicChannel(team.id, 'Mentions Only');
    await adminClient.addToChannel(user.id, channel.id);
    await adminClient.addToChannel(sender.id, channel.id);
    await adminClient.patchUser({
        id: user.id,
        notify_props: {...user.notify_props, desktop: 'all'},
    });
    const {channelsPage: senderChannelsPage} = await pw.testBrowser.login(sender);
    await senderChannelsPage.goto(team.name, channel.name);
    await senderChannelsPage.toBeVisible();

    // # Set this channel to send desktop notifications for mentions only
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();
    const notificationPreferences = await channelsPage.openChannelNotificationPreferences();
    await notificationPreferences.selectMentionsOnly();
    await notificationPreferences.save();

    // # Move to another channel, capture notifications, and post an ordinary message
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await pw.stubNotification(page, 'granted');
    await senderChannelsPage.postMessage(`ordinary message ${pw.random.id()}`);
    await pw.wait(pw.duration.two_sec);

    // * Verify the ordinary message does not create a desktop notification
    expect(await page.evaluate(() => window.getNotifications())).toHaveLength(0);

    // # Post a message that directly mentions the receiving user
    const mentionMessage = `random message with mention @${user.username} ${pw.random.id()}`;
    await senderChannelsPage.postMessage(mentionMessage);

    // * Verify the mention creates the expected desktop notification
    const notifications = await pw.waitForNotification(page, 1, pw.duration.ten_sec);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe(channel.display_name);
    expect(notifications[0].body).toBe(`@${sender.username}: ${mentionMessage}`);

    // * Verify the channel's mention badge is visible in the sidebar
    const mentionBadge = channelsPage.sidebarLeft.unreadMentionsBadge(channel.name);
    await expect(mentionBadge).toBeVisible();
});
