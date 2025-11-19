// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify admin can add custom flagging reasons
 * @test steps
 *  1. Navigate to Content Flagging (with feature enabled)
 *  2. Focus on reasons input #contentFlaggingReasons
 *  3. Add custom reason "Security Violation"
 *  4. Add custom reason "Policy Breach"
 *  5. Click Save
 *  6. Reload page and verify custom reasons persist
 */
test('MM-TXXX Configure custom flagging reasons', {tag: '@system_console'}, async ({pw}) => {
    // # Setup: Get admin user
    const {adminUser} = await pw.initSetup();

    // # Login and navigate to Content Flagging
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.goToItem('Site Configuration', 'Content Flagging');

    // # Enable Content Flagging first
    const enableToggle = systemConsolePage.page.getByTestId('EnableContentFlaggingtrue');
    await enableToggle.click();

    // # Focus on reasons input (CreatableReactSelect)
    const reasonsInput = systemConsolePage.page.locator('#contentFlaggingReasons');
    await reasonsInput.click();

    // # Type custom reason and press Tab to create
    await systemConsolePage.page.keyboard.type('Security Violation');
    await systemConsolePage.page.keyboard.press('Tab');

    // # Add second custom reason
    await systemConsolePage.page.keyboard.type('Policy Breach');
    await systemConsolePage.page.keyboard.press('Tab');

    // * Verify pills/tags appeared for both reasons
    const reasonLabels = systemConsolePage.page.locator('.contentFlaggingReasons__multi-value__label');
    await expect(reasonLabels).toContainText(['Security Violation', 'Policy Breach']);

    // # Save settings
    const saveButton = systemConsolePage.page.locator('.admin-console-save .btn-primary');
    await saveButton.click();

    // * Wait for save to complete
    await pw.waitUntil(async () => (await saveButton.textContent()) === 'Save');

    // * Reload page and verify custom reasons persist
    await systemConsolePage.page.reload();
    await expect(reasonLabels).toContainText(['Security Violation', 'Policy Breach']);
});
