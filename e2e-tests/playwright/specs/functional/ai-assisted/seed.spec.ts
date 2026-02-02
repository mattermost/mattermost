// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * Seed test for Playwright MCP agents.
 *
 * This test provides initialized page context with Mattermost-specific setup.
 * It can be used as a starting point for:
 * - @planner agent to explore the UI
 * - @generator agent to generate tests with verified selectors
 * - @healer agent to fix failing tests
 *
 * The test logs in, navigates to the channels page, and waits.
 * MCP agents can then use browser_* tools to interact with the authenticated UI.
 */
test('seed', async ({pw}) => {
    // Standard Mattermost test setup
    const {user} = await pw.initSetup();
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // Navigate to the main channels page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // Verify we're on the channels page
    await expect(channelsPage.centerView.container).toBeVisible();

    // Page is now ready for agent exploration
    // The MCP agents can use:
    // - browser_navigate: Navigate to different pages
    // - browser_click: Click elements by accessibility label/role
    // - browser_type: Type text into inputs
    // - browser_snapshot: Get accessibility tree snapshot
    // - browser_wait: Wait for conditions

    // Keep the browser open for agent interaction
    // In normal test runs, this will just pass immediately
    // When used with MCP agents, they will interact before the test completes
});

test.describe('Agent Seed Tests', () => {
    test('authenticated session ready', async ({pw}) => {
        // This test verifies the authenticated session is working
        const {user} = await pw.initSetup();
        const {page, channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // Verify basic UI elements are present
        await expect(channelsPage.sidebarLeft.container).toBeVisible();
        await expect(channelsPage.centerView.container).toBeVisible();
    });

    test('post message capability', async ({pw}) => {
        // This test verifies message posting works
        const {user} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // Post a test message
        const testMessage = `Seed test message ${pw.random.id()}`;
        await channelsPage.postMessage(testMessage);

        // Verify the message appears
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.body).toContainText(testMessage);
    });
});
