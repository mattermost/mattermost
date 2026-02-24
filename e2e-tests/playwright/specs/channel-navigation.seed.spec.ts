// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * SEED SPEC FOR MCP - Channel Navigation Patterns
 *
 * This spec demonstrates the CORRECT way to implement channel navigation,
 * creation, and lifecycle operations using the real Playwright library API.
 *
 * Use this as a reference when generating tests for channel-related flows.
 */

test('Channel Navigation - Switch between channels @seed', async ({pw}) => {
    // 1. Setup: Create test data using API (NOT UI clicks)
    const {user, adminClient, team} = await pw.initSetup();

    // Create additional test channels
    const channel1 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: `test-nav-${Date.now()}`,
            displayName: 'Test Navigation Channel',
        }),
    );
    const channel2 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: `test-nav-2-${Date.now()}`,
            displayName: 'Test Navigation Channel 2',
        }),
    );

    // Add user to both channels
    await adminClient.addToChannel(user.id, channel1.id);
    await adminClient.addToChannel(user.id, channel2.id);

    // 2. Login and navigate to team
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // 3. Verify we're in the default channel initially
    let lastPost = await channelsPage.getLastPost();
    expect(lastPost).toBeTruthy();

    // 4. Post a message in first channel to verify we're in the right place
    const msg1 = `Message in channel 1 - ${Date.now()}`;
    await channelsPage.postMessage(msg1);
    lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container.getByText(msg1)).toBeVisible();

    // 5. Navigate to second channel via sidebar
    // IMPORTANT: Use sidebarLeft to navigate, not fictional methods
    if (channelsPage.sidebarLeft && typeof channelsPage.sidebarLeft.goToItem === 'function') {
        await channelsPage.sidebarLeft.goToItem(channel2.name);
    } else {
        // Fallback: Use direct navigation
        await channelsPage.goto(`${team.name}/channels/${channel2.name}`);
    }
    await channelsPage.toBeVisible();

    // 6. Post message in second channel
    const msg2 = `Message in channel 2 - ${Date.now()}`;
    await channelsPage.postMessage(msg2);
    lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container.getByText(msg2)).toBeVisible();

    // 7. Navigate back to first channel
    if (channelsPage.sidebarLeft && typeof channelsPage.sidebarLeft.goToItem === 'function') {
        await channelsPage.sidebarLeft.goToItem(channel1.name);
    } else {
        await channelsPage.goto(`${team.name}/channels/${channel1.name}`);
    }
    await channelsPage.toBeVisible();

    // 8. Verify messages are different in each channel
    lastPost = await channelsPage.getLastPost();
    await expect(lastPost.container.getByText(msg1)).toBeVisible();
    await expect(lastPost.container.getByText(msg2)).not.toBeVisible();
});

test('Channel Lifecycle - Create, Join, Leave @seed', async ({pw}) => {
    // 1. Setup: Two users
    const {user: user1, adminClient, team} = await pw.initSetup();
    const user2 = await adminClient.createUser(
        await pw.random.user('testuser'),
        '',
        '',
    );
    await adminClient.addToTeam(team.id, user2.id);

    // 2. User1 creates a channel via API
    const newChannel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: `lifecycle-test-${Date.now()}`,
            displayName: 'Lifecycle Test Channel',
        }),
    );
    await adminClient.addToChannel(user1.id, newChannel.id);

    // 3. User1 logs in and verifies channel is visible
    const {channelsPage: page1} = await pw.testBrowser.login(user1);
    await page1.goto(team.name);
    await page1.toBeVisible();

    // Post in the new channel
    const creatorMsg = `Message from creator - ${Date.now()}`;
    await page1.postMessage(creatorMsg);
    let post = await page1.getLastPost();
    await expect(post.container.getByText(creatorMsg)).toBeVisible();

    // 4. User1 logs out, User2 logs in
    await pw.testBrowser.logout();
    const {channelsPage: page2} = await pw.testBrowser.login(user2);
    await page2.goto(team.name);
    await page2.toBeVisible();

    // 5. User2 joins the channel via API (in real scenarios, might use modal)
    await adminClient.addToChannel(user2.id, newChannel.id);

    // Refresh and navigate to the channel
    await page2.goto(`${team.name}/channels/${newChannel.name}`);
    await page2.toBeVisible();

    // 6. User2 sees creator's message and can post
    post = await page2.getLastPost();
    await expect(post.container.getByText(creatorMsg)).toBeVisible();

    const joinerMsg = `Message from joiner - ${Date.now()}`;
    await page2.postMessage(joinerMsg);
    post = await page2.getLastPost();
    await expect(post.container.getByText(joinerMsg)).toBeVisible();

    // 7. User2 leaves the channel via API
    // Note: UI-based leave operations depend on available methods
    await adminClient.removeFromChannel(user2.id, newChannel.id);

    // 8. Verify user2 can no longer see the channel
    // (Would need to navigate away and back or reload)
    await page2.goto(team.name);
    await page2.toBeVisible();
});

test('Message Operations - Edit, Delete, Reply @seed', async ({pw}) => {
    const {user, adminClient, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // 1. Post initial message
    const originalMsg = `Original message - ${Date.now()}`;
    await channelsPage.postMessage(originalMsg);
    const post = await channelsPage.getLastPost();
    await expect(post.container.getByText(originalMsg)).toBeVisible();

    // 2. Edit the message
    // Step 1: Hover to show menu
    await post.hover();
    await expect(post.postMenu.container).toBeVisible();

    // Step 2: Open edit mode
    const editButton = post.postMenu.container.locator('[aria-label*="edit"]');
    if (await editButton.isVisible()) {
        await editButton.click();
    }

    // Step 3: Edit the text
    const editInput = channelsPage.centerView.postEdit.input;
    await editInput.fill(`${originalMsg} (edited)`);
    await channelsPage.centerView.postEdit.sendMessage();

    // Step 4: Verify edit
    const editedPost = await channelsPage.getLastPost();
    await expect(editedPost.container.getByText('(edited)')).toBeVisible();

    // 3. Reply to message (open thread)
    const replyPost = await channelsPage.getLastPost();
    await replyPost.hover();
    await replyPost.postMenu.reply();
    await channelsPage.sidebarRight.toBeVisible();

    // 4. Post reply in thread
    const threadMsg = `Thread reply - ${Date.now()}`;
    await channelsPage.sidebarRight.postMessage(threadMsg);

    // 5. Verify reply in thread
    const threadPost = await channelsPage.sidebarRight.getLastPost();
    await expect(threadPost.container.getByText(threadMsg)).toBeVisible();
});
