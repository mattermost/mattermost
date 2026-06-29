// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, PolicyList} from '@mattermost/playwright-lib';

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
    test.setTimeout(120000);

    // # Skip test if no license for ABAC
    await pw.skipIfNoLicense();

    // # Set up admin user and login
    const {adminUser, adminClient} = await pw.initSetup();

    // # Login first (while ABAC is still enabled from initSetup), then navigate to admin console.
    // Note: The 'ensure ABAC is configured' global setup already enables user attributes and
    // creates the Department attribute, so we do not need ensureUserAttributes here.
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Visit admin console root first so the app initializes properly
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Navigate to the ABAC settings page via sidebar
    await systemConsolePage.sidebar.systemAttributes.attributeBasedAccess.click();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify we're on the correct page
    const abacSection = systemConsolePage.page.getByTestId('sysconsole_section_AttributeBasedAccessControl');
    await expect(abacSection).toBeVisible();

    // # Reset ABAC to disabled via API so the enable radio has an effect.
    // Do this AFTER the page has already loaded to avoid blocking the initial page load.
    // Parallel tests may have already enabled it; the radio would already be checked
    // and Save would remain disabled (no dirty state) if we don't reset it here.
    await adminClient.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: false,
        },
    } as any);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === false;
    });
    await systemConsolePage.page.goto('/admin_console/system_attributes/attribute_based_access_control');
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify we're still on the correct page after navigating with ABAC disabled
    await expect(abacSection).toBeVisible();

    const abac = systemConsolePage.attributeBasedAccessControl;
    const {enableRadio, disableRadio, saveButton} = abac;
    const policyList = new PolicyList(systemConsolePage.page.locator('#adminConsoleWrapper'));

    // # Test enable ABAC
    await enableRadio.click();
    await expect(enableRadio).toBeChecked();
    await saveButton.click();
    await systemConsolePage.page.waitForLoadState('networkidle');

    // * Verify the Attribute-Based Access page only has the toggle — no policy management here
    await expect(policyList.createPolicyButton).not.toBeVisible();

    // * Verify Membership Policies page shows "Add policy" when ABAC is enabled
    // Re-apply enable guard: a concurrent shard may have disabled ABAC between the
    // save above and this navigation, which would cause a redirect to the license page.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
    });
    await systemConsolePage.page.goto('/admin_console/system_attributes/membership_policies');
    await systemConsolePage.page.waitForLoadState('networkidle');
    await expect(policyList.createPolicyButton).toBeVisible();

    // * Verify Permission Policies page shows "Add policy" when ABAC is enabled
    // This section is only testable when the PermissionPolicies feature flag is on.
    if (await isPermissionPoliciesEnabled(adminClient)) {
        await systemConsolePage.page.goto('/admin_console/system_attributes/permission_policies');
        await systemConsolePage.page.waitForLoadState('networkidle');
        await expect(policyList.createPolicyButton).toBeVisible();
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
    await expect(policyList.createPolicyButton).not.toBeVisible();

    // # Re-enable ABAC for subsequent tests via API — avoids the race where a concurrent
    // shard's initSetup() re-enables ABAC between the disable save and here, leaving the
    // radio already checked so the UI save button stays disabled.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
});
