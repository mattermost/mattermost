// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that starting a call from a user's profile popover initiates the call in a DM channel with that user
 *
 * @precondition
 * Calls plugin must be enabled on the server
 */
test('MM-T5382 starts call in DM channel when initiated from profile popover', {tag: '@calls'}, async ({pw}) => {
    // # Setup - Create test user and admin user
    const {adminClient, user, team} = await pw.initSetup();

    // # Create admin user for the second browser context
    const adminUser = await adminClient.createUser(await pw.random.user('admin'), '', '');
    await adminClient.addToTeam(team.id, adminUser.id);

    // # Login as test user and navigate to Off-Topic channel
    const {channelsPage: userChannelsPage} = await pw.testBrowser.login(user);
    await userChannelsPage.goto(team.name, 'off-topic');
    await userChannelsPage.toBeVisible();

    // # Test user posts a message in Off-Topic
    const testMessage = `Test message ${pw.random.id()}`;
    await userChannelsPage.postMessage(testMessage);

    // * Verify message was posted
    const postedMessage = await userChannelsPage.getLastPost();
    await expect(postedMessage.body).toContainText(testMessage);

    // # Login as admin in second browser context
    const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
    await adminChannelsPage.goto(team.name, 'off-topic');
    await adminChannelsPage.toBeVisible();

    // * Verify admin can see the test user's message
    await expect(adminChannelsPage.page.getByText(testMessage)).toBeVisible();

    // # Open profile popover for test user by clicking their avatar
    const lastPost = await adminChannelsPage.getLastPost();
    await lastPost.hover();
    await lastPost.profileIcon.click();

    // * Verify profile popover is visible
    const profilePopover = adminChannelsPage.userProfilePopover;
    await profilePopover.toBeVisible();
    await expect(profilePopover.container.getByText(`@${user.username}`)).toBeVisible();

    // # Click the "Start a call" button (phone icon) in profile popover
    const startCallButton = profilePopover.container.getByRole('button', {name: /call|phone/i});
    await expect(startCallButton).toBeVisible();
    await startCallButton.click();

    // # Wait for navigation to DM channel
    await adminChannelsPage.page.waitForTimeout(1000);

    // * Verify that admin is now in DM channel with test user (not Off-Topic)
    const currentUrl = adminChannelsPage.page.url();
    await expect(currentUrl).toContain(`/messages/@${user.username}`);
    await expect(currentUrl).not.toContain('off-topic');

    // * Verify DM channel exists in sidebar with test user's username
    const dmChannelItem = adminChannelsPage.sidebarLeft.container.locator(`#sidebarItem_${user.username}`);
    await expect(dmChannelItem).toBeVisible();

    // * Verify call widget/interface is visible in the DM channel
    const callWidget = adminChannelsPage.page.locator('[data-testid="call-widget"], .call-container, [class*="call"]');
    await expect(callWidget.first()).toBeVisible({timeout: 5000});

    // * Verify the call did NOT start in Off-Topic channel
    // Navigate back to Off-Topic to verify no call there
    await adminChannelsPage.sidebarLeft.goToItem('off-topic');
    await expect(adminChannelsPage.page.url()).toContain('off-topic');

    // * Verify no call widget exists in Off-Topic
    const offTopicCallWidget = adminChannelsPage.page.locator('[data-testid="call-widget"], .call-container');
    await expect(offTopicCallWidget).not.toBeVisible();
});
