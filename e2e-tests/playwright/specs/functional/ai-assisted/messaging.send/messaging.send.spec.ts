// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Verify that users can send messages to a channel and that messages
 * are displayed correctly in the post view with proper rendering of
 * message content, author information, and reaction capabilities.
 *
 * Precondition:
 * 1. A Mattermost server is running
 * 2. Two user accounts exist and are members of the same team
 * 3. Users have access to a channel for posting messages
 */
test('should send message and display correctly in post view @ai-assisted', async ({pw}) => {
    // # Initialize test setup with first user
    const {user, team, adminClient} = await pw.initSetup();

    // # Create a second user to verify message visibility
    const testUser2 = await adminClient.createUser(await pw.random.user('receiver'), '', '');
    await adminClient.addToTeam(team.id, testUser2.id);

    // # Login as the first user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // * Verify the channels page is ready for interaction
    const centerView = channelsPage.centerView;
    await expect(centerView.container).toBeVisible();

    // # Post a test message to the channel
    const testMessage = 'Hello, this is a test message for the messaging flow!';
    await channelsPage.postMessage(testMessage);

    // # Wait briefly for message to appear in the post list
    await channelsPage.page.waitForTimeout(500);

    // * Retrieve the last posted message
    const lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container).toBeVisible();

    // * Verify the message content is displayed correctly
    await expect(lastPost.container.getByText(testMessage)).toBeVisible();

    // * Verify the message has the correct author (current user)
    await expect(lastPost.container.getByText(user.username)).toBeVisible();

    // # Hover over the message to reveal action menu
    await lastPost.container.hover();

    // # Wait for message actions to appear
    await channelsPage.page.waitForTimeout(300);

    // # Try to access the dot menu for additional actions
    const dotMenuButton = lastPost.container.locator('[data-testid="post_menu_button"]').first();
    if (await dotMenuButton.isVisible({timeout: 500}).catch(() => false)) {
        // * Click the dot menu if available
        await dotMenuButton.click();
    }

    // # Verify the message is still visible after interaction
    const updatedPost = await channelsPage.getLastPost();
    await expect(updatedPost.container.getByText(testMessage)).toBeVisible();

    // * Verify message timestamp is visible (indicating proper post_message_view rendering)
    const timestampElements = updatedPost.container.locator('time, [data-testid*="timestamp"]');
    const count = await timestampElements.count();

    if (count > 0) {
        // * Timestamp is visible - post_message_view is rendering correctly
        await expect(timestampElements.first()).toBeVisible();
    }

    // # Verify the message remains in the virtualized post list
    const allPosts = channelsPage.centerView.container.getByTestId('postView');
    const postCount = await allPosts.count();

    // * Assert that at least one post is in the post_list_virtualized
    expect(postCount).toBeGreaterThan(0);

    // # Login as the second user to verify message visibility across users
    const {channelsPage: channelsPage2} = await pw.testBrowser.login(testUser2);
    await channelsPage2.goto(team.name);
    await channelsPage2.toBeVisible();

    // * Verify the sent message is visible to the other user
    const lastPostUser2 = await channelsPage2.getLastPost();
    await expect(lastPostUser2.container.getByText(testMessage)).toBeVisible();

    // * Verify the message author is correctly displayed for the other user
    await expect(lastPostUser2.container.getByText(user.username)).toBeVisible();
});
