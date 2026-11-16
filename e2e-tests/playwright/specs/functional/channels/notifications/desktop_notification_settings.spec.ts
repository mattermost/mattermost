// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {
    expectNoNotification,
    notificationSettingCases,
    runNotificationSettingCase,
    setDesktopNotificationLevel,
} from './desktop_notification_support';

/**
 * @objective Verify a channel message does not trigger a desktop notification while that channel is in focus.
 *
 * @precondition
 * - Browser notification permission is granted
 * - The receiver's desktop notification setting is All new messages
 */
test(
    'MM-T491 Channel notifications do not send a desktop notification when in focus',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, team, userClient: senderClient} = await pw.initSetup();
        const receiver = await pw.createNewUserProfile(adminClient, {prefix: 'notification-receiver'});
        await adminClient.addToTeam(team.id, receiver.id);
        await setDesktopNotificationLevel(adminClient, receiver, 'all');

        const channel = await adminClient.getChannelByName(team.id, 'off-topic');
        const {page, channelsPage} = await pw.testBrowser.login(receiver);
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();
        await pw.stubNotification(page, 'granted');

        const message = '/echo test 3';

        // # Post a message from another user to the channel currently in focus
        await senderClient.createPost({channel_id: channel.id, message});

        // * Verify the post is rendered in the focused channel without a desktop notification
        const lastPost = await channelsPage.getLastPost();
        await lastPost.toContainText(message);
        await expectNoNotification(pw, page);
    },
);

/**
 * @objective Verify Mentions, direct messages, and group messages notifies for mentions and DMs but not ordinary posts.
 *
 * @precondition
 * - Browser notification permission is granted
 * - The receiver's desktop notification setting is Mentions, direct messages, and group messages
 */
test(
    'MM-T494 Channel notifications send desktop notifications only for mentions and direct messages',
    {tag: '@notifications'},
    async ({pw}) => {
        // # Configure mention-only notifications and send an ordinary post, a mention, and a direct message
        // * Verify only the mention and direct message produce desktop notifications
        await runNotificationSettingCase(pw, notificationSettingCases.mentions);
    },
);

/**
 * @objective Verify the Nothing desktop notification setting suppresses channel mentions and direct messages.
 *
 * @precondition
 * - Browser notification permission is granted
 * - The receiver's desktop notification setting is Nothing
 */
test('MM-T496 Channel notifications never send desktop notifications', {tag: '@notifications'}, async ({pw}) => {
    // # Disable desktop notifications and send a channel mention and direct message
    // * Verify neither message produces a desktop notification
    await runNotificationSettingCase(pw, notificationSettingCases.never);
});
