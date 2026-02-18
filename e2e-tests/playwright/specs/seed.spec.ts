import { test, expect } from '@playwright/test';

/**
 * Seed Test - Initial State for AI Test Generation
 *
 * This test sets up the environment for AI-powered test generation.
 * It demonstrates the baseline pattern that generated tests should follow.
 *
 * The AI agent uses this as a reference for:
 * - How to structure tests
 * - How to navigate Mattermost
 * - How to interact with UI elements
 */
test.describe('Mattermost E2E - Seed Setup', () => {
  test('seed: authenticate and explore UI', async ({ page }) => {
    // Navigate to Mattermost server
    await page.goto('http://localhost:8065');

    // Wait for login form to load
    await page.waitForSelector('input[id="loginId"]', { timeout: 10000 });

    // Login with test credentials
    const username = process.env.MM_TEST_USER || 'testuser';
    const password = process.env.MM_TEST_PASSWORD || 'Test@123';

    await page.fill('input[id="loginId"]', username);
    await page.fill('input[id="passwd"]', password);
    await page.click('button[type="submit"]');

    // Wait for main app to load
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="postListContent"]', { timeout: 15000 });

    // Verify we're logged in
    const mainContent = await page.locator('[data-testid="postListContent"]');
    await expect(mainContent).toBeVisible();

    // Navigate to first available channel
    const firstChannel = page.locator('[data-testid="sidebar"] [data-testid="sidebarChannel"]:first-child');
    if (await firstChannel.isVisible()) {
      await firstChannel.click();
      await page.waitForTimeout(500); // Brief delay for channel load
    }

    // Verify channel content is loaded
    const channelHeader = await page.locator('[data-testid="channelHeaderTitle"]');
    await expect(channelHeader).toBeVisible();

    // UI is now ready for exploration
    // AI agent can now:
    // - Send messages
    // - Click UI elements
    // - Navigate channels
    // - Verify content
  });
});
