// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Verify that users can successfully switch between different channels
 * and the center channel content updates correctly with proper message isolation.
 *
 * Precondition:
 * 1. A test server with default channels available
 * 2. User account with access to multiple channels
 */
test('User should be able to switch between channels and see correct content @ai-assisted', async ({pw}) => {
    // Initialize with user and team setup
    const {user, team} = await pw.initSetup();

    // Login as the test user and navigate to the team
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // Verify we are in the town-square channel
    await expect(channelsPage.centerView.container.getByText('Town Square')).toBeVisible();

    // Post a unique message in town-square
    const message1 = `Test message in town-square - ${new Date().getTime()}`;
    await channelsPage.postMessage(message1);
    const lastPost1 = await channelsPage.getLastPost();
    await expect(lastPost1.container.getByText(message1)).toBeVisible();

    // Navigate to the off-topic channel
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.centerView.container.waitForLoadState('networkidle');

    // Verify we switched to off-topic channel
    await expect(channelsPage.centerView.container.getByText('Off-Topic')).toBeVisible();

    // Verify the first message is not visible in off-topic
    const messageContainer = channelsPage.centerView.postList.container;
    await expect(messageContainer.getByText(message1)).not.toBeVisible();

    // Post a different message in off-topic
    const message2 = `Test message in off-topic - ${new Date().getTime()}`;
    await channelsPage.postMessage(message2);
    const lastPost2 = await channelsPage.getLastPost();
    await expect(lastPost2.container.getByText(message2)).toBeVisible();

    // Navigate back to town-square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.centerView.container.waitForLoadState('networkidle');

    // Verify we are back on town-square with the original message
    await expect(channelsPage.centerView.container.getByText('Town Square')).toBeVisible();
    const messageContainerAgain = channelsPage.centerView.postList.container;
    await expect(messageContainerAgain.getByText(message1)).toBeVisible();

    // Verify the second message from off-topic is not visible in town-square
    await expect(messageContainerAgain.getByText(message2)).not.toBeVisible();
});
