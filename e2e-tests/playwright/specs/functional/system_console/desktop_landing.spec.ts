// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

// Helper function to intercept API request and modify the response
async function interceptConfigWithLandingPage(page: Page, enabled: boolean) {
    const apiUrl = '**/api/v4/config/client?format=old**';
    await page.route(apiUrl, (route) => {
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                EnableDesktopLandingPage: enabled,
                EnableSignInWithUsername: 'true',
            }),
            headers: {'Content-Type': 'application/json'},
        });
    });
}

test('MM-T5640_1 should not see landing page ', async ({pw, page}) => {
    await interceptConfigWithLandingPage(page, false);

    // Navigate to your starting URL
    await page.goto('/');

    // Wait until the URL contains '/login'
    await page.waitForURL(/.*\/login.*/);

    // At this point, the URL should contain '/login'
    expect(page.url()).toContain('/login');

    // Verify the login page is visible
    await pw.loginPage.toBeVisible();
});

test('MM-T5640_2 should see landing page', async ({pw, page}) => {
    // Navigate to your starting URL
    await page.goto('/');

    // Wait until the URL contains '/landing'
    await page.waitForURL(/.*\/landing.*/, {timeout: pw.duration.ten_sec});

    // At this point, the URL should contain '/landing'
    expect(page.url()).toContain('/landing');

    // Verify the landing page is visible
    await pw.landingLoginPage.toBeVisible();
});
