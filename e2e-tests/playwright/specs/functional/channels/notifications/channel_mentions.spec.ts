// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify disabling "Ignore mentions" counts @channel, @here, and @all as mentions.
 */
test('MM-T568 Channel Notifications turn off Ignore mentions for @channel, @here and @all', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const [sender] = await adminClient.createUsers(team.id, 1, 'channel-mentions');
    const channelA = await adminClient.createPublicChannel(team.id, 'Mention Source');
    const channelB = await adminClient.createPublicChannel(team.id, 'Mention Away');
    await adminClient.addToChannel(user.id, channelA.id);
    await adminClient.addToChannel(user.id, channelB.id);
    await adminClient.addToChannel(sender.id, channelA.id);

    // # Open channel notification preferences and turn off ignore mentions
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channelA.name);
    await channelsPage.toBeVisible();
    const notificationPreferences = await channelsPage.openChannelNotificationPreferences();
    if (await notificationPreferences.ignoreMentionsCheckbox.isChecked()) {
        await notificationPreferences.ignoreMentionsCheckbox.uncheck();
    }
    await notificationPreferences.save();

    // # Move away and post each channel-wide mention from another user. @here only mentions users who
    // are currently online, so force the receiving user's status online first to avoid a race against
    // their websocket connection setting it asynchronously. Space the posts apart since firing them
    // back-to-back races the per-post async mention-count update and can under-count the total.
    await adminClient.updateStatus({user_id: user.id, status: 'online'});
    await channelsPage.goto(team.name, channelB.name);
    await adminClient.createPost({channel_id: channelA.id, user_id: sender.id, message: '@all test'});
    await pw.wait(duration.one_sec);
    await adminClient.createPost({channel_id: channelA.id, user_id: sender.id, message: '@channel test'});
    await pw.wait(duration.one_sec);
    await adminClient.createPost({channel_id: channelA.id, user_id: sender.id, message: '@here test'});

    // * Verify the channel is unread and counts all 3 channel-wide mentions exactly
    await channelsPage.sidebarLeft.assertItemUnread(channelA.name);
    await expect(channelsPage.sidebarLeft.unreadMentionsBadge(channelA.name)).toHaveText('3');
});
