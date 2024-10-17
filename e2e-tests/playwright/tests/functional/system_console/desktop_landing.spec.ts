import { test, expect, chromium, Page } from '@playwright/test';

// Helper function to intercept API request and modify the response
async function interceptConfigWithLandingPage(page: Page, enabled: boolean) {
    const apiUrl = '**/api/v4/config/client?format=old**';
    await page.route(apiUrl, route => {
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                    "EmailLoginButtonBorderColor": "#2389D7",
                    "EmailLoginButtonColor": "#0000",
                    "EmailLoginButtonTextColor": "#2389D7",
                    "EnableDesktopLandingPage": enabled,
                    "EnableSignInWithEmail": "true",
                    "EnableSignInWithUsername": "true",
                    "EnableSignUpWithEmail": "true",
                    "SiteName": "Mattermost",
                    "SiteURL": "http://localhost:8065",
            }),
            headers: { 'Content-Type': 'application/json' }
        });
    });
}

test('MM-T5640_1 should not see landing page ', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await interceptConfigWithLandingPage(page, false);

    // Navigate to your starting URL
    await page.goto('http://localhost:8065');

    // Wait until the URL contains '/landing'
    await page.waitForURL(/.*\/login.*/);

    // At this point, the URL should contain '/landing'
    expect(page.url()).toContain('/login');
    
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('domcontentloaded');

    page.locator('#saveSetting').waitFor()
    const logiButton = page.locator('#saveSetting');
    await expect(logiButton).toHaveText('Log in')

});

test('MM-T5640_2 should see landing page', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to your starting URL
    await page.goto('http://localhost:8065');

    await page.evaluate(() => localStorage.clear());

    // Clear local storage to see the landing page
    const localStorageLength = await page.evaluate(() => localStorage.length);
    expect(localStorageLength).toBe(0);

    await page.goto('http://localhost:8065');

    // Wait until the URL contains '/landing'
    await page.waitForURL(/.*\/landing.*/);

    // At this point, the URL should contain '/landing'
    expect(page.url()).toContain('/landing');

    const viewInDesktopButoon = page.locator('a.btn-primary');
    await expect(viewInDesktopButoon).toHaveText('View in Desktop App')
    
    const viewInDesktopBrowser = page.locator('a.btn-tertiary');
    await expect(viewInDesktopBrowser).toHaveText('View in Browser')

});
