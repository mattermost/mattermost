// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@e2e-support/test_fixture';

test('MM-T483 Channel-wide mentions with uppercase letters', async ({pw, pages, headless, browserName}) => {
    test.skip(
        headless && browserName !== 'firefox',
        'Works across browsers and devices, except in headless mode, where stubbing the Notification API is supported only in Firefox and WebKit.',
    );

    // Initialize setup and get the required users and team
    const {team, adminUser, user} = await pw.initSetup();

    // Log in as the admin in one browser session and navigate to the "town-square" channel
    const {page: adminPage} = await pw.testBrowser.login(adminUser);
    const adminChannelPage = new pages.ChannelsPage(adminPage);
    await adminChannelPage.goto(team.name, 'town-square');
    await adminChannelPage.toBeVisible();

    // Stub the Notification in the admin's browser to capture notifications
    await pw.stubNotification(adminPage, 'granted');

    // Log in as the regular user in a separate browser and navigate to the "off-topic" channel
    const {page: otherPage} = await pw.testBrowser.login(user);
    const otherChannelPage = new pages.ChannelsPage(otherPage);
    await otherChannelPage.goto(team.name, 'off-topic');
    await otherChannelPage.toBeVisible();

    // Post a channel-wide mention message "@ALL" in uppercase from the user's browser
    const message = `@ALL good morning, ${team.name}!`;
    await otherChannelPage.postMessage(message);

    // Wait for a notification to be received in the admin's browser and verify its content
    const notifications = await pw.waitForNotification(adminPage);
    expect(notifications.length).toBe(1);

    const notification = notifications[0];
    expect(notification.title).toBe('Off-Topic');
    expect(notification.body).toBe(`@${user.username}: ${message}`);
    expect(notification.tag).toBe(`@${user.username}: ${message}`);
    expect(notification.icon).toContain('.png');
    expect(notification.requireInteraction).toBe(false);
    expect(notification.silent).toBe(false);

    // Verify the last post as viewed by the regular user in the "off-topic" channel contains the message and is highlighted
    const otherLastPost = await otherChannelPage.centerView.getLastPost();
    await otherLastPost.toContainText(message);
    await expect(otherLastPost.container.locator('.mention--highlight')).toBeVisible();
    await expect(otherLastPost.container.locator('.mention--highlight').getByText('@ALL')).toBeVisible();

    // Admin navigates to the "off-topic" channel and verifies the message is posted and highlighted correctly
    await adminChannelPage.goto(team.name, 'off-topic');
    const adminLastPost = await adminChannelPage.centerView.getLastPost();
    await adminLastPost.toContainText(message);
    await expect(adminLastPost.container.locator('.mention--highlight')).toBeVisible();
    await expect(adminLastPost.container.locator('.mention--highlight').getByText('@ALL')).toBeVisible();
});
