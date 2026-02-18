// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * Seed Test - Initial State for AI Test Generation
 *
 * This test sets up the environment for AI-powered test generation.
 * It demonstrates the baseline pattern that generated tests should follow.
 *
 * The AI agent uses this as a reference for:
 * - How to authenticate using Mattermost utilities (pw fixture)
 * - How to navigate Mattermost UI
 * - How to interact with page elements
 * - Configuration from playwright.config.ts
 */
test(
    'seed: authenticate and explore UI',
    {tag: ['@ai-generated', '@seed']},
    async ({pw, page}) => {
        // # Setup: Authenticate user and navigate to app
        // Uses baseURL from playwright.config.ts automatically
        // Credentials come from testConfig via @mattermost/playwright-lib

        // Set landing page as seen so we skip intro
        await pw.hasSeenLandingPage();

        // # Go to login page
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // # Get admin client for any admin operations needed
        const {adminClient} = await pw.getAdminClient();

        // # Perform user login
        // Uses user credentials from testConfig (environment variables)
        await pw.loginPage.login();

        // # Verify logged in and main app is loaded
        await pw.toMainPage();
        await page.waitForLoadState('networkidle');

        // # Navigate to first available channel
        const channelSidebar = page.locator('button[aria-label*="channel"]').first();
        if (await channelSidebar.isVisible()) {
            await channelSidebar.click();
            await page.waitForLoadState('networkidle');
        }

        // # Verify we're in a channel ready for testing
        const channelHeader = page.locator('[data-testid="channelHeaderTitle"]');
        await expect(channelHeader).toBeVisible({timeout: 10000});

        // UI is now ready for exploration
        // AI agent can now:
        // - Send messages via postMessage()
        // - Click and interact with UI elements
        // - Navigate between channels
        // - Verify content using expect()
        // - Use pw utilities for common operations
    },
);
