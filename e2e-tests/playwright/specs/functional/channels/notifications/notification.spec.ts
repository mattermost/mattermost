// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that channel-wide mentions with uppercase letters trigger notifications and are properly highlighted.
 *
 * @precondition
 * - Two users are members of the same team
 * - Notification permissions are granted in the browser
 */
test(
    'MM-T483 triggers notification with uppercase channel-wide mention and highlights message for all users',
    {tag: '@notifications'},
    async ({pw, headless, browserName}) => {
        test.skip(
            headless && browserName !== 'firefox',
            'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
        );

        // # Initialize setup and get the required users and team
        const {team, adminUser, user} = await pw.initSetup();

        // # Log in as the admin in one browser session and navigate to the "town-square" channel
        const {page: adminPage, channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, 'town-square');
        await adminChannelsPage.toBeVisible();

        // # Stub the Notification in the admin's browser to capture notifications
        await pw.stubNotification(adminPage, 'granted');

        // # Log in as the regular user in a separate browser and navigate to the "off-topic" channel
        const {channelsPage: otherChannelsPage} = await pw.testBrowser.login(user);
        await otherChannelsPage.goto(team.name, 'off-topic');
        await otherChannelsPage.toBeVisible();

        // # Post a channel-wide mention message "@ALL" in uppercase from the user's browser
        const message = `@ALL good morning, ${team.name}!`;
        await otherChannelsPage.postMessage(message);

        // * Verify notification is received in the admin's browser with correct content
        const notifications = await pw.waitForNotification(adminPage);
        expect(notifications.length).toBe(1);

        const notification = notifications[0];
        expect(notification.title).toBe('Off-Topic');
        expect(notification.body).toBe(`@${user.username}: ${message}`);
        expect(notification.tag).toBe(`@${user.username}: ${message}`);
        expect(notification.icon).toContain('.png');
        expect(notification.requireInteraction).toBe(false);
        expect(notification.silent).toBe(false);

        // * Verify the last post as viewed by the regular user in the "off-topic" channel contains the message and is highlighted
        const otherLastPost = await otherChannelsPage.getLastPost();
        await otherLastPost.toContainText(message);
        await expect(otherLastPost.container.locator('.mention--highlight')).toBeVisible();
        await expect(otherLastPost.container.locator('.mention--highlight').getByText('@ALL')).toBeVisible();

        // # Navigate admin to the "off-topic" channel
        await adminChannelsPage.goto(team.name, 'off-topic');

        // * Verify the message is posted and highlighted correctly for the admin user
        const adminLastPost = await adminChannelsPage.getLastPost();
        await adminLastPost.toContainText(message);
        await expect(adminLastPost.container.locator('.mention--highlight')).toBeVisible();
        await expect(adminLastPost.container.locator('.mention--highlight').getByText('@ALL')).toBeVisible();
    },
);
