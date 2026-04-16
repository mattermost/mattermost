// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test('MM-T5782 System admin can enable or disable system-wide ABAC', async ({pw}) => {
    // # Skip test if no license for ABAC
    await pw.skipIfNoLicense();

    // # Set up admin user and login.
    // initSetup resets the server config to defaults; default_config.ts sets
    // EnableAttributeBasedAccessControl: true so ABAC is enabled from the start.
    const {adminUser} = await pw.initSetup();

    // # Now login
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to ABAC page
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.systemAttributes.attributeBasedAccess.click();

    // * Verify we're on the correct page
    const abacSection = systemConsolePage.page.getByTestId('sysconsole_section_AttributeBasedAccessControl');
    await expect(abacSection).toBeVisible();

    const enableRadio = systemConsolePage.page.locator(
        '#AccessControlSettings\\.EnableAttributeBasedAccessControltrue',
    );
    const disableRadio = systemConsolePage.page.locator(
        '#AccessControlSettings\\.EnableAttributeBasedAccessControlfalse',
    );
    const saveButton = systemConsolePage.page.getByRole('button', {name: 'Save'});

    // * Verify ABAC starts enabled (default config sets it to true)
    await expect(enableRadio).toBeChecked();

    // # Test enable ABAC
    await enableRadio.click();
    await expect(enableRadio).toBeChecked();
    await saveButton.click();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify the Attribute-Based Access page only has the toggle — no policy management here
    await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).not.toBeVisible();

    // * Verify Membership Policies page shows "Add policy" when ABAC is enabled
    await systemConsolePage.page.goto('/admin_console/system_attributes/membership_policies');
    await systemConsolePage.page.waitForLoadState('networkidle');
    await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).toBeVisible();

    // * Verify Permission Policies page shows "Add policy" when ABAC is enabled
    await systemConsolePage.page.goto('/admin_console/system_attributes/permission_policies');
    await systemConsolePage.page.waitForLoadState('networkidle');
    await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).toBeVisible();

    // # Navigate back to Attribute-Based Access to test disable
    await systemConsolePage.page.goto('/admin_console/system_attributes/attribute_based_access_control');
    await systemConsolePage.page.waitForLoadState('networkidle');

    // # Test disable ABAC, then immediately re-enable to keep the shared server
    // state clean for parallel tests. try/finally ensures re-enable runs even if
    // an assertion fails mid-way.
    try {
        await disableRadio.click();
        await expect(disableRadio).toBeChecked();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify Membership Policies no longer shows "Add policy" when ABAC is disabled
        await systemConsolePage.page.goto('/admin_console/system_attributes/membership_policies');
        await systemConsolePage.page.waitForLoadState('networkidle');
        await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).not.toBeVisible();

        // # Re-enable ABAC for subsequent tests
        await systemConsolePage.page.goto('/admin_console/system_attributes/attribute_based_access_control');
        await systemConsolePage.page.waitForLoadState('networkidle');
    } finally {
        // # Re-enable ABAC via UI. The page is still on the ABAC settings page;
        // clicking the enable radio and saving is the most reliable restore path.
        await enableRadio.click();
        if (!(await saveButton.isDisabled())) {
            await saveButton.click();
            await systemConsolePage.page.waitForLoadState('networkidle');
        }
    }
});
