// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @zephyr MM-T5931
 * @objective Verify user can successfully switch between public channels and content updates correctly
 * @test_steps
 * 1. Navigate to first test channel via sidebar
 * 2. Verify channel view updates with correct channel name
 * 3. Post a test message in channel 1
 * 4. Verify message appears in post list
 * 5. Switch to second test channel via sidebar
 * 6. Verify channel switched (different name, no previous message)
 * 7. Return to first channel
 * 8. Verify message persists in first channel
 */
test('MM-T5931 switches between public channels and persists messages', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create two test channels via API
    const channel1 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-channel-one',
            displayName: 'Demo Channel One',
        }),
    );
    const channel2 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-channel-two',
            displayName: 'Demo Channel Two',
        }),
    );

    // # Add user to both channels
    await adminClient.addToChannel(user.id, channel1.id);
    await adminClient.addToChannel(user.id, channel2.id);

    // # Login and navigate to channels page
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Navigate to first test channel via sidebar
    await channelsPage.sidebarLeft.goToItem(channel1.name);
    await channelsPage.centerView.toBeVisible();

    // * Verify channel view updates with correct channel name
    await expect(channelsPage.page.locator('.channel-header')).toContainText('Demo Channel One');

    // # Post a test message in channel 1
    const testMessage = `Test message at ${Date.now()}`;
    await channelsPage.centerView.postCreate.postMessage(testMessage);

    // * Verify message appears in post list
    // Wait for the message to appear in the actual post list (not input box)
    const postList = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList.locator(`text=${testMessage}`).first()).toBeVisible({timeout: 10000});

    // # Switch to second test channel via sidebar
    await channelsPage.sidebarLeft.goToItem(channel2.name);
    await channelsPage.centerView.toBeVisible();

    // * Verify channel switched (different name, no previous message)
    await expect(channelsPage.page.locator('.channel-header')).toContainText('Demo Channel Two');
    const postList2 = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList2.locator(`text=${testMessage}`)).not.toBeVisible();

    // # Return to first channel
    await channelsPage.sidebarLeft.goToItem(channel1.name);
    await channelsPage.centerView.toBeVisible();

    // * Verify message persists in first channel
    const postList3 = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList3.locator(`text=${testMessage}`).first()).toBeVisible();
});

/**
 * @zephyr MM-T5932
 * @objective Verify user can switch between three channels and each maintains its content
 * @test_steps
 * 1. Create three test channels
 * 2. Post unique message in channel 1
 * 3. Switch to channel 2 and post different message
 * 4. Switch to channel 3 and post different message
 * 5. Return to channel 1 and verify first message persists
 * 6. Return to channel 2 and verify second message persists
 */
test('MM-T5932 switches between multiple channels with message persistence', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create three test channels via API
    const channel1 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-channel-alpha',
            displayName: 'Demo Channel Alpha',
        }),
    );
    const channel2 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-channel-beta',
            displayName: 'Demo Channel Beta',
        }),
    );
    const channel3 = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-channel-gamma',
            displayName: 'Demo Channel Gamma',
        }),
    );

    // # Add user to all three channels
    await adminClient.addToChannel(user.id, channel1.id);
    await adminClient.addToChannel(user.id, channel2.id);
    await adminClient.addToChannel(user.id, channel3.id);

    // # Login and navigate to channels page
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Navigate to channel 1 and post message
    await channelsPage.sidebarLeft.goToItem(channel1.name);
    await channelsPage.centerView.toBeVisible();
    const message1 = `Alpha message ${Date.now()}`;
    await channelsPage.centerView.postCreate.postMessage(message1);
    const postList1 = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList1.locator(`text=${message1}`).first()).toBeVisible({timeout: 10000});

    // # Switch to channel 2 and post message
    await channelsPage.sidebarLeft.goToItem(channel2.name);
    await channelsPage.centerView.toBeVisible();
    const message2 = `Beta message ${Date.now()}`;
    await channelsPage.centerView.postCreate.postMessage(message2);
    const postList2 = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList2.locator(`text=${message2}`).first()).toBeVisible({timeout: 10000});

    // # Switch to channel 3 and post message
    await channelsPage.sidebarLeft.goToItem(channel3.name);
    await channelsPage.centerView.toBeVisible();
    const message3 = `Gamma message ${Date.now()}`;
    await channelsPage.centerView.postCreate.postMessage(message3);
    const postList3 = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList3.locator(`text=${message3}`).first()).toBeVisible({timeout: 10000});

    // # Return to channel 1 - verify first message persists
    await channelsPage.sidebarLeft.goToItem(channel1.name);
    await channelsPage.centerView.toBeVisible();
    const postList1Again = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList1Again.locator(`text=${message1}`).first()).toBeVisible();

    // # Return to channel 2 - verify second message persists
    await channelsPage.sidebarLeft.goToItem(channel2.name);
    await channelsPage.centerView.toBeVisible();
    const postList2Again = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(postList2Again.locator(`text=${message2}`).first()).toBeVisible();
});

/**
 * @zephyr MM-T5933
 * @objective Verify user can switch from public channel to DM and conversation loads correctly
 * @test_steps
 * 1. Start in public channel
 * 2. Switch to DM channel via sidebar
 * 3. Verify DM channel opened with correct user header
 * 4. Send message in DM
 * 5. Verify DM message appears
 * 6. Switch back to public channel
 * 7. Return to DM
 * 8. Verify DM message persists
 */
test('MM-T5933 switches from public channel to direct message', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create a public channel via API
    const publicChannel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'demo-public-channel',
            displayName: 'Demo Public Channel',
        }),
    );

    // # Add user to the public channel
    await adminClient.addToChannel(user.id, publicChannel.id);

    // # Create another user for DM
    const dmPartner = await adminClient.createUser(pw.random.user(), '', '');
    await adminClient.addToTeam(team.id, dmPartner.id);

    // # Create DM channel via API
    await adminClient.createDirectChannel([user.id, dmPartner.id]);

    // # Login and navigate to channels page
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);
    await channelsPage.toBeVisible();

    // # Start in public channel
    await channelsPage.sidebarLeft.goToItem(publicChannel.name);
    await channelsPage.centerView.toBeVisible();

    // * Verify we're in the public channel
    await expect(channelsPage.page.locator('.channel-header')).toContainText('Demo Public Channel');

    // # Switch to DM channel by navigating directly (DMs don't appear in sidebar until first message)
    await channelsPage.page.goto(`/${team.name}/messages/@${dmPartner.username}`);
    await channelsPage.centerView.toBeVisible();

    // * Verify DM channel opened with correct user header
    await expect(channelsPage.page.locator('.channel-header')).toContainText(dmPartner.username);

    // # Send message in DM
    const dmMessage = `DM test message at ${Date.now()}`;
    await channelsPage.centerView.postCreate.postMessage(dmMessage);

    // * Verify DM message appears
    const dmPostList = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(dmPostList.locator(`text=${dmMessage}`).first()).toBeVisible({timeout: 10000});

    // # Switch back to public channel
    await channelsPage.sidebarLeft.goToItem(publicChannel.name);
    await channelsPage.centerView.toBeVisible();
    await expect(channelsPage.page.locator('.channel-header')).toContainText('Demo Public Channel');

    // # Return to DM - use direct navigation again
    await channelsPage.page.goto(`/${team.name}/messages/@${dmPartner.username}`);
    await channelsPage.centerView.toBeVisible();

    // * Verify DM message persists
    const dmPostListAgain = channelsPage.page.locator('#postListContent, #virtualizedPostListContent');
    await expect(dmPostListAgain.locator(`text=${dmMessage}`).first()).toBeVisible();
});
