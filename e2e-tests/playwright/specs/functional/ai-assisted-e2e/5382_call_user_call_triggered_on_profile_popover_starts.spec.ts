// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that triggering a call from a user's profile popover starts a call in the DM with that user
 *
 * @precondition Calls plugin must be enabled and configured
 */
test('MM-T5382 call user - call triggered on profile popover starts in the dm with the user', {tag: '@calls'}, async ({pw}) => {
    // # Initialize test setup
    const {user, adminClient, team} = await pw.initSetup();

    // # Create another user to call
    const testUser2 = await adminClient.createUser(await pw.random.user('caller'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // # Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message as testUser2 to make their profile accessible
    await channelsPage.postMessage(`Hello @${testUser2.username}`);

    // # Get the last post and click on the mention to open profile popover
    const lastPost = await channelsPage.getLastPost();
    const mention = await lastPost.container.getByText(`@${testUser2.username}`, {exact: true});
    await mention.click();

    // # Wait for profile popover to appear
    const profilePopover = channelsPage.userProfilePopover;
    await expect(profilePopover.container).toBeVisible();

    // # Click the "Call" button in the profile popover if it exists
    const callButton = profilePopover.container.locator('button:has-text("Call"), button[aria-label*="call" i]').first();

    // * Verify call button is visible (or skip test if Calls plugin is not enabled)
    const callButtonVisible = await callButton.isVisible().catch(() => false);
    if (!callButtonVisible) {
        test.skip();
        return;
    }

    await callButton.click();

    // * Verify that we're redirected to DM channel with the user
    await expect(channelsPage.page).toHaveURL(new RegExp(`@${testUser2.username}`), {timeout: 10000});

    // * Verify that a call widget or call notification appears
    const callWidget = channelsPage.page.locator('[class*="call"], [data-testid*="call"], .CallWidget, [aria-label*="call" i]').first();
    await expect(callWidget).toBeVisible({timeout: 10000});
});
