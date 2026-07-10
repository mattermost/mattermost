// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

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
