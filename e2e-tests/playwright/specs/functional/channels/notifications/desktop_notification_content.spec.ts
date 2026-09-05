// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {
    displayNameCases,
    expectSingleNotification,
    runDisplayNameCase,
    setDesktopNotificationLevel,
} from './desktop_notification_support';

/**
 * @objective Verify all-activity desktop notifications preserve apostrophes and emoji text while stripping markdown.
 *
 * @precondition
 * - Browser notification permission is granted
 * - The receiver's desktop notification setting is All new messages
 */
test(
    'MM-T487 Desktop Notifications for all activity with apostrophe, emoji, and markdown',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, team, user: sender, userClient: senderClient} = await pw.initSetup();
        const receiver = await pw.createNewUserProfile(adminClient, {prefix: 'notification-receiver'});
        await adminClient.addToTeam(team.id, receiver.id);
        await setDesktopNotificationLevel(adminClient, receiver, 'all');

        const channel = await adminClient.getChannelByName(team.id, 'off-topic');
        const {page, channelsPage} = await pw.testBrowser.login(receiver);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await pw.stubNotification(page, 'granted');

        const message =
            "*I'm* [hungry](http://example.com) :taco: ![Mattermost](https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png)";

        // # Post a message containing an apostrophe, markdown, emoji text, a link, and an image
        await senderClient.createPost({channel_id: channel.id, message});

        // * Verify the notification body contains plain text without markdown syntax or URLs
        await expectSingleNotification(pw, page, {
            title: channel.display_name,
            body: `@${sender.username}: I'm hungry :taco: Mattermost`,
        });
    },
);

/**
 * @objective Verify username display preference formats the sender name in desktop notifications.
 */
test(
    'MM-T488 Desktop Notifications with teammate name display set to username',
    {tag: '@notifications'},
    async ({pw}) => {
        // # Configure username display and post a mention from another user
        // * Verify the desktop notification displays the sender's username and exact message body
        await runDisplayNameCase(pw, displayNameCases.username);
    },
);

/**
 * @objective Verify nickname display preference uses a nickname when present in desktop notifications.
 */
test(
    'MM-T489_1 Desktop Notifications display teammate nickname when nickname exists',
    {tag: '@notifications'},
    async ({pw}) => {
        // # Configure nickname display and post a mention from a sender with a nickname
        // * Verify the desktop notification displays the sender's nickname and exact message body
        await runDisplayNameCase(pw, displayNameCases.nickname);
    },
);
