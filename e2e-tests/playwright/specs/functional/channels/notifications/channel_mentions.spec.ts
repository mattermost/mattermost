// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
    const {app, channelsPage} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: channelA.name});
    const notificationPreferences = await channelsPage.openChannelNotificationPreferences();
    if (await notificationPreferences.ignoreMentionsCheckbox.isChecked()) {
        await notificationPreferences.ignoreMentionsCheckbox.uncheck();
    }
    await notificationPreferences.save();

    // # Move away and post each channel-wide mention from another user. @here only mentions users who
    // are currently online, so force the receiving user's status online first. Switch channels within
    // the app: a full page load closes the websocket, which marks the user offline until it reconnects.
    await adminClient.updateStatus({user_id: user.id, status: 'online'});
    await channelsPage.sidebarLeft.goToItem(channelB.name);
    await channelsPage.centerView.header.toHaveTitle(channelB.display_name);
    const mentionCount = async () => (await adminClient.getChannelMember(channelA.id, user.id)).mention_count;
    const messages = ['@all test', '@channel test', '@here test'];
    for (const [i, message] of messages.entries()) {
        await pw.postAs(sender, {channel_id: channelA.id, message});
        await expect
            .poll(mentionCount, {message: `the server counts "${message}" as a mention before the next post`})
            .toBe(i + 1);
    }

    // * Verify the channel's mention badge counts all 3 channel-wide mentions exactly
    await expect(app.lhs.channelList.channel(channelA).mentionBadgeText.locator).toHaveText('3');
});
