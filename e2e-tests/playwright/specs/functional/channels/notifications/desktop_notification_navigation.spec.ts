// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify clicking a desktop notification for a message in another team's channel navigates
 * the user to that team and channel.
 *
 * @precondition
 * - Desktop notifications are set to "All new messages" so a non-mention post triggers a notification
 * - Notification permissions are granted in the browser
 */
test(
    'MM-T492 navigates to the originating team and channel when a desktop notification is clicked',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, adminUser, team, user} = await pw.initSetup();

        // # Add the user to a second team that hosts the channel the notification will come from
        const secondTeam = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Second Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(secondTeam.id, user.id);
        await adminClient.addToTeam(secondTeam.id, adminUser.id);
        const otherChannel = await adminClient.getChannelByName(secondTeam.id, 'off-topic');

        // # Set the user's desktop notifications to fire for all new messages
        await adminClient.patchUser({
            id: user.id,
            notify_props: {
                ...user.notify_props,
                desktop: 'all',
                desktop_sound: 'false',
            },
        });

        // # Log in and view the first team's Town Square, then stub notifications
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await pw.stubNotification(page, 'granted');

        // # Post a message from the admin in the second team's channel
        const message = `Click notification from other team ${pw.random.id()}`;
        await adminClient.createPost({channel_id: otherChannel.id, user_id: adminUser.id, message});

        // * Verify a desktop notification is received for the second team's channel
        const notifications = await pw.waitForNotification(page);
        expect(notifications.length).toBe(1);
        expect(notifications[0].title).toBe('Off-Topic');
        expect(notifications[0].body).toContain(message);

        // # Click the desktop notification
        await pw.clickNotification(page);

        // * Verify the app navigates to the second team's channel where the message was posted
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain(`/${secondTeam.name}/`);
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');
        await channelsPage.centerView.waitUntilLastPostContains(message);
    },
);

/**
 * @objective Verify clicking a desktop notification for a direct message navigates the user to that DM.
 *
 * @precondition
 * - Notification permissions are granted in the browser
 */
test(
    'MM-T493 navigates to the direct message when its desktop notification is clicked',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, adminUser, team, user} = await pw.initSetup();

        // # Create a direct message channel between the admin and the user
        const dmChannel = await adminClient.createDirectChannel([adminUser.id, user.id]);

        // # Log in and view Town Square, then stub notifications
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await pw.stubNotification(page, 'granted');

        // # Send a direct message from the admin to the user
        const message = `Click notification from DM ${pw.random.id()}`;
        await adminClient.createPost({channel_id: dmChannel.id, user_id: adminUser.id, message});

        // * Verify a desktop notification is received for the direct message
        const notifications = await pw.waitForNotification(page);
        expect(notifications.length).toBe(1);
        expect(notifications[0].body).toContain(message);

        // # Click the desktop notification
        await pw.clickNotification(page);

        // * Verify the app navigates to the direct message conversation with the admin
        await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).toContain('/messages/');
        await channelsPage.centerView.header.toHaveTitle(adminUser.username);
        await channelsPage.centerView.waitUntilLastPostContains(message);
    },
);

/**
 * @objective Verify a user in "Do Not Disturb" does not receive desktop notifications, and receives them
 * again once the status is cleared.
 *
 * @precondition
 * - Notification permissions are granted in the browser
 */
test(
    'MM-T495 suppresses desktop notifications while Do Not Disturb is enabled',
    {tag: '@notifications'},
    async ({pw}) => {
        const {adminClient, adminUser, team, user} = await pw.initSetup();

        // # Create a direct message channel between the admin and the user
        const dmChannel = await adminClient.createDirectChannel([adminUser.id, user.id]);

        // # Log in and view Town Square (not the DM), then stub notifications
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await pw.stubNotification(page, 'granted');

        // # Send a direct message from the admin while the user is available
        const firstMessage = `DND baseline ${pw.random.id()}`;
        await adminClient.createPost({channel_id: dmChannel.id, user_id: adminUser.id, message: firstMessage});

        // * Verify the direct message triggers a desktop notification
        const notifications = await pw.waitForNotification(page);
        expect(notifications.length).toBe(1);
        expect(notifications[0].body).toContain(firstMessage);

        // # Enable Do Not Disturb via the slash command
        await channelsPage.postMessage('/dnd');

        // * Verify the Do Not Disturb system message confirms it is enabled
        await channelsPage.centerView.waitUntilLastPostContains('Do Not Disturb is enabled');

        // # Send another direct message from the admin while the user is in Do Not Disturb
        const secondMessage = `DND suppressed ${pw.random.id()}`;
        await adminClient.createPost({channel_id: dmChannel.id, user_id: adminUser.id, message: secondMessage});

        // * Verify no second desktop notification is received while in Do Not Disturb
        const suppressed = await pw.waitForNotification(page, 2, pw.duration.two_sec);
        expect(suppressed).toHaveLength(0);

        // # Clear the status back to online via the slash command
        await channelsPage.postMessage('/online');

        // * Verify the account menu reflects the online status
        const accountMenu = await channelsPage.openUserAccountMenu();
        await expect(accountMenu.online).toHaveAttribute('aria-checked', 'true');
    },
);
