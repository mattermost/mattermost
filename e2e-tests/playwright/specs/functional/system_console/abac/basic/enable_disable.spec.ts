// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {ensureUserAttributes} from '../support';

/**
 * ABAC Basic Operations - Enable/Disable
 * Tests basic ABAC system-wide enable/disable functionality
 */
test.describe('ABAC Basic Operations - Enable/Disable', () => {
    test('MM-T5782 System admin can enable or disable system-wide ABAC', async ({pw}) => {
        // # Skip test if no license for ABAC
        await pw.skipIfNoLicense();

        // # Set up admin user and login
        const {adminUser, adminClient} = await pw.initSetup();

        // # Ensure user attributes exist BEFORE logging in
        await ensureUserAttributes(adminClient);

        // # Now login - this ensures the UI will have the attributes loaded
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

        // # Test enable ABAC
        await enableRadio.click();
        await expect(enableRadio).toBeChecked();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify policy management UI is visible when enabled
        const addPolicyButton = systemConsolePage.page.getByRole('button', {name: 'Add policy'});
        const runSyncJobButton = systemConsolePage.page.getByRole('button', {name: 'Run Sync Job'});
        await expect(addPolicyButton).toBeVisible();
        await expect(runSyncJobButton).toBeVisible();

        // # Test disable ABAC
        await disableRadio.click();
        await expect(disableRadio).toBeChecked();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Verify policy management UI is hidden when disabled
        await expect(addPolicyButton).not.toBeVisible();
        await expect(runSyncJobButton).not.toBeVisible();

        // # Re-enable ABAC for subsequent tests
        await enableRadio.click();
        await saveButton.click();
        await systemConsolePage.page.waitForLoadState('networkidle');
    });
});
