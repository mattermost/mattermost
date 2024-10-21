import {test, expect, chromium, Page} from '@playwright/test';

// Helper function to intercept API request and modify the response
async function interceptConfigWithLandingPage(page: Page, enabled: boolean) {
    const apiUrl = '**/api/v4/config/client?format=old**';
    await page.route(apiUrl, (route) => {
        route.fulfill({
            status: 200,
            body: JSON.stringify({
                EmailLoginButtonBorderColor: '#2389D7',
                EmailLoginButtonColor: '#0000',
                EmailLoginButtonTextColor: '#2389D7',
                EnableDesktopLandingPage: enabled,
                EnableSignInWithEmail: 'true',
                EnableSignInWithUsername: 'true',
                EnableSignUpWithEmail: 'true',
                SiteName: 'Mattermost',
                SiteURL: 'http://localhost:8065',
            }),
            headers: {'Content-Type': 'application/json'},
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

    // Wait until the URL contains '/login'
    await page.waitForURL(/.*\/login.*/);

    // At this point, the URL should contain '/login'
    expect(page.url()).toContain('/login');

    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('domcontentloaded');

    page.locator('#saveSetting').waitFor();
    const loginButton = page.locator('#saveSetting');
    await expect(loginButton).toHaveText('Log in');
});

test('MM-T5640_2 should see landing page', async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to your starting URL
    await page.goto('http://localhost:8065');

    await page.evaluate(() => localStorage.clear());

    await page.goto('http://localhost:8065');

    // Wait until the URL contains '/landing'
    await page.waitForURL(/.*\/landing.*/);

    // At this point, the URL should contain '/landing'
    expect(page.url()).toContain('/landing');

    // Check the user agent
    const userAgent = await page.evaluate(() => navigator.userAgent);

    const viewInAppButton = page.locator('a.btn-primary');
    await expect(viewInAppButton).toBeVisible();
    await expect(viewInAppButton).toHaveText(userAgent.includes('iPad') ? 'View in App' : 'View in Desktop App');

    const viewInBrowser = page.locator('a.btn-tertiary');
    await expect(viewInBrowser).toHaveText('View in Browser');
});
