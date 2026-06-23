// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the System Console does not allow clearing the Site URL: saving an empty Site URL
 * shows a validation error and the original value is preserved after reload.
 */
test("MM-T3279 Don't allow clearing site URL in System Console", {tag: '@system_console'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user during initSetup');
    }

    // # Log in as the system admin in a new browser context
    const {page} = await pw.testBrowser.login(adminUser);

    // # Navigate to System Console -> Environment -> Web Server
    await page.goto('/admin_console/environment/web_server');

    const siteUrlInput = page.getByTestId('ServiceSettings.SiteURLinput');
    await expect(siteUrlInput).toBeVisible();

    // # Note the original Site URL value
    const originalSiteUrl = await siteUrlInput.inputValue();

    // # Clear the Site URL and save
    await siteUrlInput.clear();
    await page.getByTestId('saveSetting').click();

    // * Verify the validation error is shown
    await expect(page.getByTestId('errorMessage')).toContainText('Site URL cannot be cleared.');

    // # Reload the page
    await page.goto('/admin_console/environment/web_server');

    // * Verify the Site URL retains its original value
    await expect(page.getByTestId('ServiceSettings.SiteURLinput')).toHaveValue(originalSiteUrl);
});
