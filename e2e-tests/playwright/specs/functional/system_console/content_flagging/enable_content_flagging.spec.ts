// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can enable content flagging and configure basic settings
 * @test steps
 *  1. Navigate to System Console → Content Flagging
 *  2. Click Enable radio button [data-testid="EnableContentFlaggingtrue"]
 *  3. Verify subsection fields become enabled
 *  4. Set "Require Reporter Comment" to false
 *  5. Click Save button
 *  6. Verify save completes
 *  7. Reload page and verify settings persisted
 */
test('MM-TXXX Enable content flagging with basic configuration', {tag: '@system_console'}, async ({pw}) => {
    // # Setup: Get admin user
    const {adminUser} = await pw.initSetup();

    // # Login as system admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to System Console
    await systemConsolePage.goto();

    // # Navigate to Content Flagging settings
    await systemConsolePage.sidebar.goToItem('Site Configuration', 'Content Flagging');

    // * Verify we're on the Content Flagging page
    await expect(systemConsolePage.page).toHaveURL(/admin_console\/site_config\/content_flagging/);

    // # Enable Content Flagging (discovered selector from source code)
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await enableToggle.click();

    // * Verify enable toggle is checked
    await expect(enableToggle).toBeChecked();

    // * Verify subsection fields become enabled
    const reporterCommentToggle = systemConsolePage.page.getByTestId('requireReporterComment_true');
    await expect(reporterCommentToggle).toBeEnabled();

    // # Set "Require Reporter Comment" to false
    const reporterCommentFalse = systemConsolePage.page.getByTestId('requireReporterComment_false');
    await reporterCommentFalse.click();

    // * Verify it's now set to false
    await expect(reporterCommentFalse).toBeChecked();

    // # Click Save button
    const saveButton = systemConsolePage.page.locator('.admin-console-save .btn-primary');
    await saveButton.click();

    // * Wait for save to complete (button text changes from "Saving Config..." to "Save")
    await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

    // * Reload page and verify settings persisted
    await systemConsolePage.page.reload();
    await expect(enableToggle).toBeChecked();
    await expect(reporterCommentFalse).toBeChecked();
});
