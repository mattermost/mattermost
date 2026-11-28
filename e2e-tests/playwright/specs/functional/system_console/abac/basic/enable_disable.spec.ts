// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Api,
    openSystemConsoleSection,
    systemConsolePath,
    expect,
    settle,
    test,
    duration,
} from '@mattermost/playwright-lib';

import {ensureUserAttributes} from '../support';
import {ABAC_SETTINGS_PATH, MEMBERSHIP_POLICIES_PATH, openMembershipPolicies} from '../surface';

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
    await expect(app.page).toHavePath(systemConsolePath('system_attributes/attribute_based_access_control'));

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
    await settle(saveButton, {wait: Api.PatchConfig}).click();
    await expect(saveButton).toBeSaved();

    // * Verify the Attribute-Based Access page only has the toggle — no policy management here
    await expect(app.admin.accessControl.policies.addButton).toBeHidden();

    // * Verify Membership Policies page shows "Add policy" when ABAC is enabled
    // Re-apply enable guard: a concurrent shard may have disabled ABAC between the
    // save above and this navigation, which would cause a redirect to the license page.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
    await pw.waitUntil(async () => {
        const cfg = await adminClient.getConfig();
        return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
    });
    const policies = await openMembershipPolicies(app);
    await expect(policies.addButton).toBeVisible();

    // # Navigate back to Attribute-Based Access to test disable
    await app.page.goto(ABAC_SETTINGS_PATH);
    await expect(abacSection).toBeVisible();

    // # Test disable ABAC
    await disableRadio.check();
    await expect(disableRadio).toBeChecked();
    await settle(saveButton, {wait: Api.PatchConfig}).click();
    await expect(saveButton).toBeSaved();

    // * Verify Membership Policies is no longer reachable when ABAC is disabled: the console sends the admin away
    await app.page.goto(MEMBERSHIP_POLICIES_PATH);
    await expect(app.page).not.toHavePath(systemConsolePath('system_attributes/membership_policies'));

    // # Re-enable ABAC for subsequent tests via API — avoids the race where a concurrent
    // shard's initSetup() re-enables ABAC between the disable save and here, leaving the
    // radio already checked so the UI save button stays disabled.
    await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
});
