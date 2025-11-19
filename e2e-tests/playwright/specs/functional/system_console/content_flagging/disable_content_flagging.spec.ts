// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can disable content flagging and dependent fields become disabled
 * @test steps
 *  1. Navigate to Content Flagging (with feature enabled)
 *  2. Click Disable radio button [data-testid="EnableContentFlaggingfalse"]
 *  3. Verify dependent fields become disabled
 *  4. Click Save
 *  5. Reload and verify content flagging remains disabled
 */
test('MM-TXXX Disable content flagging in system console', {tag: '@system_console'}, async ({pw}) => {
    // # Setup: Get admin user
    const {adminUser} = await pw.initSetup();

    // # Login and navigate to Content Flagging
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.goToItem('Site Configuration', 'Content Flagging');

    // # Enable Content Flagging first
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await enableToggle.click();

    // * Verify subsection fields are enabled
    const reporterCommentTrue = systemConsolePage.page.getByTestId('requireReporterComment_true');
    await expect(reporterCommentTrue).toBeEnabled();

    // # Now disable Content Flagging
    const disableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingfalse');
    await disableToggle.click();

    // * Verify disable toggle is checked
    await expect(disableToggle).toBeChecked();

    // * Verify dependent fields become disabled
    await expect(reporterCommentTrue).toBeDisabled();

    // # Save settings
    const saveButton = systemConsolePage.page.locator('.admin-console-save .btn-primary');
    await saveButton.click();

    // * Wait for save to complete
    await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

    // * Reload and verify content flagging remains disabled
    await systemConsolePage.page.reload();
    await expect(disableToggle).toBeChecked();
    await expect(reporterCommentTrue).toBeDisabled();
});
