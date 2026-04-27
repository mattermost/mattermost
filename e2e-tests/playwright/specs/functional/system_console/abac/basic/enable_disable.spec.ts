// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {ensureUserAttributes} from '../support';

/**
 * Check whether the PermissionPolicies feature flag is enabled at runtime.
 * Returns true when the server exposes the permission_policies route.
 */
async function isPermissionPoliciesEnabled(adminClient: any): Promise<boolean> {
    const config = await adminClient.getConfig();
    return config.FeatureFlags?.PermissionPolicies === true || config.FeatureFlags?.PermissionPolicies === 'true';
}

/**
 * ABAC Basic Operations - Enable/Disable
 * Tests basic ABAC system-wide enable/disable functionality
 */

test('MM-T5782 System admin can enable or disable system-wide ABAC', async ({pw}) => {
    // # Skip test if no license for ABAC
    await pw.skipIfNoLicense();

    // # Set up admin user and login
    const {adminUser, adminClient} = await pw.initSetup();

    // # Ensure user attributes exist BEFORE logging in
    await ensureUserAttributes(adminClient);

    // # Reset ABAC to disabled via API before testing the UI toggle.
    // Parallel tests may have already enabled it, which would leave the radio
    // pre-selected and the Save button permanently disabled (no dirty state).
    const config = await adminClient.getConfig();
    config.AccessControlSettings.EnableAttributeBasedAccessControl = false;
    await adminClient.updateConfig(config);

    // # Now login - this ensures the UI will have the attributes loaded
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to ABAC page
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();
    await systemConsolePage.sidebar.systemAttributes.attributeBasedAccess.click();

    // Re-apply the ABAC=false reset right before UI interaction: a concurrent
    // initSetup() on another shard may have re-enabled ABAC between the initial
    // updateConfig call above and here. If it's already enabled when we click
    // enableRadio the radio is a no-op and Save stays disabled.
    const freshConfig = await adminClient.getConfig();
    freshConfig.AccessControlSettings.EnableAttributeBasedAccessControl = false;
    await adminClient.updateConfig(freshConfig);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === false;
    });
    await systemConsolePage.page.reload();
    await systemConsolePage.page.waitForLoadState('networkidle');

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

    // # Test enable ABAC
    await enableRadio.click();
    await expect(enableRadio).toBeChecked();
    await saveButton.click();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify the Attribute-Based Access page only has the toggle — no policy management here
    await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).not.toBeVisible();

    // * Verify Membership Policies page shows "Add policy" when ABAC is enabled
    // Re-apply enable guard: a concurrent shard may have disabled ABAC between the
    // save above and this navigation, which would cause a redirect to the license page.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
    await systemConsolePage.page.goto('/admin_console/system_attributes/membership_policies');
    await systemConsolePage.page.waitForLoadState('networkidle');
    await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).toBeVisible();

    // * Verify Permission Policies page shows "Add policy" when ABAC is enabled
    // This section is only testable when the PermissionPolicies feature flag is on.
    if (await isPermissionPoliciesEnabled(adminClient)) {
        await systemConsolePage.page.goto('/admin_console/system_attributes/permission_policies');
        await systemConsolePage.page.waitForLoadState('networkidle');
        await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).toBeVisible();
    }

    // # Navigate back to Attribute-Based Access to test disable
    await systemConsolePage.page.goto('/admin_console/system_attributes/attribute_based_access_control');
    await systemConsolePage.page.waitForLoadState('networkidle');

    // # Test disable ABAC
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
    await enableRadio.click();
    await saveButton.click();
    await systemConsolePage.page.waitForLoadState('networkidle');
});
