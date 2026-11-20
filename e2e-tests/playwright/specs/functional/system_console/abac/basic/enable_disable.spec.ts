// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    waitForApi,
    openSystemConsoleSection,
    systemConsolePath,
    expect,
    test,
    duration,
} from '@mattermost/playwright-lib';

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
    test.setTimeout(duration.two_min);

    // # Skip test if no license for ABAC
    await pw.skipIfNoLicense();

    // # Set up admin user and login
    const {adminUser, adminClient} = await pw.initSetup();

    // # Ensure user attributes exist BEFORE logging in
    await ensureUserAttributes(adminClient);

    // # Reset ABAC to disabled via API before testing the UI toggle.
    // Parallel tests may have already enabled it, which would leave the radio
    // pre-selected and the Save button permanently disabled (no dirty state).
    await adminClient.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: false,
        },
    } as any);

    // # Now login - this ensures the UI will have the attributes loaded
    const {app} = await pw.testBrowser.login(adminUser);

    // # Navigate to ABAC page
    await openSystemConsoleSection(app);
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
    await app.admin.sidebar.category('system_attributes').section('attribute_based_access_control').titleLink.click();
    await expect(app.page).toHaveURL(/attribute_based_access_control/);

    // Re-apply the ABAC=false reset right before UI interaction: a concurrent
    // initSetup() on another shard may have re-enabled ABAC between the initial
    // patchConfig call above and here. If it's already enabled when we click
    // enableRadio the radio is a no-op and Save stays disabled.
    await adminClient.patchConfig({
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: false,
        },
    } as any);
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === false;
    });
    await app.page.reload();
    await app.page.waitForLoadState('networkidle');

    // * Verify we're on the correct page
    const abacSection = app.admin.screen('AttributeBasedAccessControl');
    await expect(abacSection).toBeVisible();
    const abacSetting = app.admin.setting('AccessControlSettings.EnableAttributeBasedAccessControl');
    const enableRadio = abacSetting.trueRadio;
    const disableRadio = abacSetting.falseRadio;
    const saveButton = app.admin.saveButton;

    // # Test enable ABAC
    await enableRadio.check();
    await expect(enableRadio).toBeChecked();
    await Promise.all([waitForApi(app.page, Api.PatchConfig), saveButton.click()]);
    await app.page.waitForLoadState('networkidle');

    // * Verify the Attribute-Based Access page only has the toggle — no policy management here
    // The policy action has no generated part; check its accessible name within the declared screen.
    await expect(
        app.admin.screen('AttributeBasedAccessControl').locator.getByRole('button', {name: 'Add policy'}),
    ).not.toBeVisible();

    // * Verify Membership Policies page shows "Add policy" when ABAC is enabled
    // Re-apply enable guard: a concurrent shard may have disabled ABAC between the
    // save above and this navigation, which would cause a redirect to the license page.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
    });
    await app.page.goto(systemConsolePath('system_attributes/membership_policies'));
    await app.page.waitForLoadState('networkidle');
    // The policy action has no generated part; check its accessible name within the declared screen.
    await expect(
        app.admin.screen('MembershipPolicies').locator.getByRole('button', {name: 'Add policy'}),
    ).toBeVisible();

    // * Verify Permission Policies page shows "Add policy" when ABAC is enabled
    // This section is only testable when the PermissionPolicies feature flag is on.
    if (await isPermissionPoliciesEnabled(adminClient)) {
        await app.page.goto(systemConsolePath('system_attributes/permission_policies'));
        await app.page.waitForLoadState('networkidle');
        // The policy action has no generated part; check its accessible name within the declared screen.
        await expect(
            app.admin.screen('PermissionPolicies').locator.getByRole('button', {name: 'Add policy'}),
        ).toBeVisible();
    }

    // # Navigate back to Attribute-Based Access to test disable
    await app.page.goto(systemConsolePath('system_attributes/attribute_based_access_control'));
    await app.page.waitForLoadState('networkidle');

    // # Test disable ABAC
    await disableRadio.check();
    await expect(disableRadio).toBeChecked();
    await Promise.all([waitForApi(app.page, Api.PatchConfig), saveButton.click()]);
    await app.page.waitForLoadState('networkidle');

    // * Verify Membership Policies no longer shows "Add policy" when ABAC is disabled
    await app.page.goto(systemConsolePath('system_attributes/membership_policies'));
    await app.page.waitForLoadState('networkidle');
    // The policy action has no generated part; check its accessible name within the declared screen.
    await expect(
        app.admin.screen('MembershipPolicies').locator.getByRole('button', {name: 'Add policy'}),
    ).not.toBeVisible();

    // # Re-enable ABAC for subsequent tests via API — avoids the race where a concurrent
    // shard's initSetup() re-enables ABAC between the disable save and here, leaving the
    // radio already checked so the UI save button stays disabled.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
});
